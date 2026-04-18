/**
 * Upload da foto do produto Infoprodutor para o bucket público `infoprodutor-images`.
 * - Recebe FormData { file: File, old_path?: string } do cliente autenticado.
 * - Usa SERVICE_ROLE para escrever/remover (bucket público de leitura, sem política
 *   de INSERT para authenticated — evita spam de qualquer origem).
 * - Retorna `{ url, path }`; a `url` pública é a que guardamos em `produtos_infoprodutor.image_url`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BUCKET = "infoprodutor-images";
const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Env ausente: ${name}`);
  return v;
}

function supabaseAdmin() {
  return createSupabaseAdmin(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
}

function extForType(ct: string): string {
  if (ct === "image/png") return "png";
  if (ct === "image/jpeg" || ct === "image/jpg") return "jpg";
  if (ct === "image/webp") return "webp";
  if (ct === "image/gif") return "gif";
  return "bin";
}

function publicUrlFor(path: string): string {
  const base = getEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function POST(req: NextRequest) {
  try {
    const supaUser = await createClient();
    const { data: { user }, error: authErr } = await supaUser.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file");
    const oldPathField = form.get("old_path");
    const oldPath = typeof oldPathField === "string" && oldPathField.trim() ? oldPathField.trim() : null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Envie a imagem em 'file'." }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: "Formato inválido. Use PNG, JPEG, WebP ou GIF." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Imagem muito grande (máx 5MB)." }, { status: 400 });
    }

    const admin = supabaseAdmin();

    if (oldPath && oldPath.startsWith(`${user.id}/`)) {
      await admin.storage.from(BUCKET).remove([oldPath]).catch(() => null);
    }

    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const ext = extForType(file.type);
    const path = `${user.id}/${ts}-${rand}.${ext}`;

    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: "3600",
    });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, path, url: publicUrlFor(path) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
