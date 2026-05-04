import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { isValidCpf, normalizeCpf } from "@/lib/cpf";
import {
  checkAndIncrementSignupRateLimit,
  getClientIp,
} from "@/lib/signup-rate-limit";

function normalizeCoupon(code: unknown): string {
  return String(code ?? "")
    .trim()
    .toUpperCase();
}

/**
 * Lê o cookie `signup_track` (setado em /track_vendors/<vendor> via
 * TrackHandler.tsx) e devolve o nome do vendor pra persistir em
 * `profiles.user_track`. Se ausente, malformado ou maior que 40 chars,
 * retorna null — cadastro pela home padrão sai sem track.
 *
 * O regex aqui DEVE espelhar o do TrackHandler client-side. Servidor
 * é a última linha de defesa: cookie pode ter sido editado manualmente.
 */
const SAFE_TRACK = /^[a-zA-Z0-9_-]{1,40}$/;
async function readSignupTrack(): Promise<string | null> {
  try {
    const store = await cookies();
    const raw = store.get("signup_track")?.value?.trim();
    if (!raw) return null;
    const decoded = decodeURIComponent(raw);
    return SAFE_TRACK.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function normalizeWhatsapp(raw: unknown): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  return d;
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service env ausente");
  return createClient(url, key);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body?.password ?? "");
    const whatsapp = normalizeWhatsapp(body?.whatsapp);
    const couponCode = normalizeCoupon(body?.coupon_code);
    const cpfRaw = body?.cpf;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Senha deve ter pelo menos 6 caracteres." }, { status: 400 });
    }
    if (whatsapp.length < 10 || whatsapp.length > 15) {
      return NextResponse.json({ error: "Informe um WhatsApp válido (DDD + número)." }, { status: 400 });
    }
    if (!couponCode) {
      return NextResponse.json({ error: "Informe o cupom." }, { status: 400 });
    }

    // Valida CPF via algoritmo dos dígitos verificadores. Bloqueia também
    // sequências repetidas (`11111111111`, etc.) que passariam no módulo 11.
    const cpf = normalizeCpf(cpfRaw);
    if (!cpf || !isValidCpf(cpf)) {
      return NextResponse.json(
        { error: "CPF inválido. Verifique os dígitos." },
        { status: 400 },
      );
    }

    const supabase = admin();

    // Rate limit por IP — defensa contra criação massiva de contas.
    // Defaults (5 tentativas / 1h) definidos em `signup-rate-limit.ts`.
    const clientIp = getClientIp(req);
    if (clientIp) {
      const rl = await checkAndIncrementSignupRateLimit(supabase, clientIp);
      if (!rl.allowed) {
        const minutes = Math.ceil(rl.retryAfterSeconds / 60);
        return NextResponse.json(
          {
            error: `Muitas tentativas de cadastro deste IP. Aguarde ${minutes} minuto${minutes !== 1 ? "s" : ""} e tente novamente.`,
          },
          {
            status: 429,
            headers: { "Retry-After": String(rl.retryAfterSeconds) },
          },
        );
      }
    }

    // CPF unique — bloqueia usuário que já fez trial de criar conta nova
    // com o mesmo CPF (mesmo que mude e-mail / WhatsApp / IP).
    const { data: existingByCpf, error: cpfQueryErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("cpf", cpf)
      .maybeSingle();
    if (cpfQueryErr) {
      return NextResponse.json(
        { error: "Erro ao validar CPF. Tente novamente." },
        { status: 500 },
      );
    }
    if (existingByCpf) {
      return NextResponse.json(
        {
          error:
            "Este CPF já tem uma conta cadastrada. Entre na sua conta existente ou fale com o suporte.",
        },
        { status: 409 },
      );
    }

    const { data: couponRow, error: cErr } = await supabase
      .from("trial_coupons")
      .select("id, duration_days, is_active, max_uses, uses_count")
      .eq("code", couponCode)
      .maybeSingle();

    if (cErr || !couponRow) {
      return NextResponse.json({ error: "Cupom inválido." }, { status: 400 });
    }
    if (!couponRow.is_active) {
      return NextResponse.json({ error: "Este cupom não está ativo." }, { status: 400 });
    }
    if ((couponRow.uses_count ?? 0) >= (couponRow.max_uses ?? 0)) {
      return NextResponse.json({ error: "Cupom esgotado." }, { status: 400 });
    }

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr || !created?.user?.id) {
      const msg = createErr?.message ?? "";
      if (/already|registered|exists/i.test(msg)) {
        return NextResponse.json({ error: "Este e-mail já está cadastrado. Faça login ou use outro e-mail." }, { status: 409 });
      }
      return NextResponse.json({ error: createErr?.message ?? "Falha ao criar conta." }, { status: 500 });
    }

    const userId = created.user.id;
    const trialUntil = new Date();
    trialUntil.setUTCDate(trialUntil.getUTCDate() + Number(couponRow.duration_days ?? 1));

    // Tracking de origem (vendor): cookie setado quando o usuário visita
    // /track_vendors/<vendor>?track=<nome>. Cadastro pela home padrão
    // não tem cookie → user_track fica NULL.
    const userTrack = await readSignupTrack();

    const { error: profErr } = await supabase.from("profiles").insert([
      {
        id: userId,
        email,
        subscription_status: "active",
        plan_tier: "trial",
        plan_name: "Trial gratuito (cupom)",
        trial_access_until: trialUntil.toISOString(),
        whatsapp_phone: whatsapp,
        cpf,
        account_setup_pending: false,
        user_track: userTrack,
      },
    ]);

    if (profErr) {
      await supabase.auth.admin.deleteUser(userId);
      // Race condition: CPF criado por outro signup paralelo entre o check
      // e o insert. Mensagem clara pro user em vez do erro cru do Postgres.
      if (/duplicate key|unique/i.test(profErr.message)) {
        return NextResponse.json(
          {
            error:
              "Este CPF já tem uma conta cadastrada. Entre na sua conta existente ou fale com o suporte.",
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    const { data: incOk, error: incErr } = await supabase.rpc("trial_coupon_increment_use", {
      p_code: couponCode,
    });

    if (incErr || incOk !== true) {
      await supabase.from("profiles").delete().eq("id", userId);
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Não foi possível aplicar o cupom (tente novamente)." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      trial_access_until: trialUntil.toISOString(),
      duration_days: couponRow.duration_days,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro no cadastro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
