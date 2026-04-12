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

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 3 * 1024 * 1024;

function extForType(ct: string): string {
  if (ct === "image/png") return "png";
  if (ct === "image/jpeg") return "jpg";
  if (ct === "image/webp") return "webp";
  return "bin";
}

export async function POST(req: NextRequest) {
  const { supabase: supaUser } = supabaseUser(req);
  const { data: authData, error: authErr } = await supaUser.auth.getUser();

  if (authErr || !authData?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const siteIdField = form.get("site_id");
  const oldPathField = form.get("old_path");

  const siteIdFromForm = typeof siteIdField === "string" ? siteIdField : undefined;
  const oldPath = typeof oldPathField === "string" && oldPathField.trim() ? oldPathField.trim() : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo em 'file'." }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Formato inválido. Use PNG, JPEG ou WebP." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande (máx 3MB)." }, { status: 400 });
  }

  const resolved = await resolveCaptureSiteIdForUser(supaUser, siteIdFromForm);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: resolved.status });
  }
  const site = { id: resolved.siteId };

  const admin = supabaseAdmin();

  if (oldPath) {
    if (!oldPath.startsWith(`${authData.user.id}/${site.id}/blank-hero/`)) {
      return NextResponse.json({ error: "Caminho antigo inválido." }, { status: 400 });
    }
    const { error: rmErr } = await admin.storage.from(BUCKET).remove([oldPath]);
    if (rmErr) {
      return NextResponse.json({ error: rmErr.message }, { status: 400 });
    }
  }

  const ts = Date.now();
  const ext = extForType(file.type);
  const path = `${authData.user.id}/${site.id}/blank-hero/hero-${ts}.${ext}`;

  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: "3600",
  });

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, path });
}
