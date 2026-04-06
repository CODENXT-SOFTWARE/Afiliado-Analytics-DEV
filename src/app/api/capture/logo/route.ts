import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const runtime = "nodejs";

const LOGO_BUCKET = "capture-logos";

function supabaseAdmin() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    process.env.NEXTPUBLICSUPABASEURL;

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SERVICE_ROLE_KEY ??
    process.env.SUPABASESERVICEROLEKEY;

  if (!supabaseUrl || !serviceKey) throw new Error("Supabase envs ausentes.");
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const supabase = supabaseAdmin();

  // 1) Auth (token do usuário no header Authorization)
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Sem token" }, { status: 401 });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  // 2) Lê formData
  const form = await req.formData();
  const siteId = String(form.get("siteId") ?? "");
  const file = form.get("file");

  if (!siteId) return NextResponse.json({ error: "siteId obrigatório" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });

  // 3) Validações (entrada só PNG, por exemplo)
  if (file.type !== "image/png") {
    return NextResponse.json({ error: "Apenas PNG" }, { status: 400 });
  }

  const maxBytes = 1 * 1024 * 1024; // 1MB
  if (file.size > maxBytes) {
    return NextResponse.json({ error: "Arquivo muito grande (máx 1MB)" }, { status: 400 });
  }

  // 4) Garante que o site é do usuário (ajuste o nome da tabela/colunas)
  const { data: site, error: siteErr } = await supabase
    .from("capture_sites")
    .select("id, userid")
    .eq("id", siteId)
    .maybeSingle();

  if (siteErr || !site) return NextResponse.json({ error: "Site não encontrado" }, { status: 404 });
  if (site.userid !== userData.user.id) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  // 5) Converte para webp 256x256 (logo.webp)
  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const outBuffer = await sharp(inputBuffer)
    .resize(256, 256, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const path = `${userData.user.id}/${siteId}/logo.webp`;

  // 6) Upload (upsert)
  const { error: upErr } = await supabase.storage.from(LOGO_BUCKET).upload(path, outBuffer, {
    contentType: "image/webp",
    upsert: true,
    cacheControl: "3600",
  });

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  // 7) Salva no banco
  const { error: dbErr } = await supabase
    .from("capture_sites")
    .update({ logopath: path })
    .eq("id", siteId)
    .eq("userid", userData.user.id);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, path }, { status: 200 });
}
