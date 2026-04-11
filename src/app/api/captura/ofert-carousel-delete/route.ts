import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { resolveCaptureSiteIdForUser } from "@/lib/captura-resolve-site";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Env ausente: ${name}`);
  return v;
}

function supabaseAdmin() {
  return createClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
}

function supabaseUser(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );
  return { supabase, res };
}

const BUCKET = "capture-logos";

export async function POST(req: NextRequest) {
  const { supabase: supaUser } = supabaseUser(req);
  const { data: authData, error: authErr } = await supaUser.auth.getUser();

  if (authErr || !authData?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const siteIdFromClient = typeof body?.site_id === "string" ? body.site_id : undefined;
  const path = typeof body?.path === "string" ? body.path.trim() : "";

  if (!path) {
    return NextResponse.json({ error: "path obrigatório." }, { status: 400 });
  }

  if (!path.startsWith(`${authData.user.id}/`)) {
    return NextResponse.json({ error: "Caminho inválido." }, { status: 400 });
  }

  const resolved = await resolveCaptureSiteIdForUser(supaUser, siteIdFromClient);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: resolved.status });
  }

  if (!path.includes(`/carousel/`) && !path.includes(`/promo-avatars/`)) {
    return NextResponse.json(
      { error: "Apenas imagens do carrossel ou fotos de depoimentos (Aurora) podem ser removidas aqui." },
      { status: 400 },
    );
  }

  const admin = supabaseAdmin();
  const { error: rmErr } = await admin.storage.from(BUCKET).remove([path]);
  if (rmErr) return NextResponse.json({ error: rmErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
