/**
 * Cron horário: para cada instância Evolution, chama o webhook n8n (buscar_grupo),
 * normaliza contagens e aplica o mesmo fluxo do POST /api/gpl/group-snapshots.
 *
 * Vercel Cron: GET com Authorization: Bearer CRON_SECRET (igual grupos-venda/cron-disparo).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "utils/supabase/server";
import {
  applyGplGroupSnapshot,
  normalizeN8nGruposLista,
} from "@/lib/gpl-apply-group-snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type CronResult = {
  ok: true;
  processed: number;
  results: { instanceId: string; userId: string; nomeInstancia: string; ok: boolean; groupCount?: number; error?: string }[];
};

type CronResultOrConfigError = CronResult | { ok: false; error: string };

async function runGplCronSync(options?: { userId?: string }): Promise<CronResultOrConfigError> {
  const url = (process.env.EVOLUTION_N8N_WEBHOOK_URL ?? "").trim();
  if (!url) {
    return { ok: false, error: "EVOLUTION_N8N_WEBHOOK_URL não configurado" };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, error: "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente" };
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  let q = supabase.from("evolution_instances").select("id, user_id, nome_instancia").order("created_at", { ascending: true });
  if (options?.userId) {
    q = q.eq("user_id", options.userId);
  }
  const { data: instances, error: instErr } = await q;

  if (instErr) {
    return { ok: false, error: instErr.message };
  }
  if (!instances?.length) {
    return { ok: true, processed: 0, results: [] };
  }

  const results: CronResult["results"] = [];

  for (const row of instances) {
    const instanceId = row.id as string;
    const userId = row.user_id as string;
    const nomeInstancia = String(row.nome_instancia ?? "").trim();
    if (!nomeInstancia) {
      results.push({ instanceId, userId, nomeInstancia: "", ok: false, error: "nome_instancia vazio" });
      continue;
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoAcao: "buscar_grupo",
          nomeInstancia,
          getParticipants: false,
        }),
      });
      const text = await res.text();
      let json: { grupos?: unknown; erro?: string };
      try {
        json = JSON.parse(text) as { grupos?: unknown; erro?: string };
      } catch {
        results.push({
          instanceId,
          userId,
          nomeInstancia,
          ok: false,
          error: `Resposta não-JSON (${res.status})`,
        });
        continue;
      }
      if (!res.ok) {
        results.push({
          instanceId,
          userId,
          nomeInstancia,
          ok: false,
          error: json?.erro ?? `Webhook ${res.status}`,
        });
        continue;
      }

      const payload = normalizeN8nGruposLista(json?.grupos);
      const applied = await applyGplGroupSnapshot(supabase, userId, instanceId, payload);
      if (!applied.ok) {
        results.push({
          instanceId,
          userId,
          nomeInstancia,
          ok: false,
          error: applied.error,
        });
        continue;
      }
      results.push({
        instanceId,
        userId,
        nomeInstancia,
        ok: true,
        groupCount: payload.length,
      });
    } catch (e) {
      results.push({
        instanceId,
        userId,
        nomeInstancia,
        ok: false,
        error: e instanceof Error ? e.message : "Erro",
      });
    }
  }

  return { ok: true, processed: instances.length, results };
}

export async function GET(req: NextRequest) {
  const onVercel = process.env.VERCEL === "1";
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();

  if (onVercel) {
    if (!cronSecret) {
      return NextResponse.json(
        {
          error:
            "CRON_SECRET não configurado na Vercel. Adicione em Environment Variables (igual ao cron de grupos de venda).",
        },
        { status: 503 }
      );
    }
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const out = await runGplCronSync();
  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: 503 });
  }
  return NextResponse.json(out);
}

/** Teste manual: só sincroniza instâncias do usuário logado. */
export async function POST(req: NextRequest) {
  const supabaseAuth = await createServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const out = await runGplCronSync({ userId: user.id });
  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: 503 });
  }
  return NextResponse.json(out);
}
