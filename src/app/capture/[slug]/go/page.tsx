import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { detectBot } from "../../../../lib/bot-detection";


export const dynamic = "force-dynamic";

const DOMAIN = "s.afiliadoanalytics.com.br";
const LOGO_BUCKET = "capture-logos";

function admin() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

  if (!supabaseUrl)
    throw new Error(
      "Env do Supabase ausente: defina NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_URL."
    );
  if (!serviceKey)
    throw new Error(
      "Env do Supabase ausente: defina SUPABASE_SERVICE_ROLE_KEY ou SERVICE_ROLE_KEY."
    );

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}

function getIpFromHeaders(h: Headers): string | null {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  return h.get("x-real-ip") ?? null;
}

async function hashIp(ip: string): Promise<string> {
  const crypto = await import("crypto");
  const salt = process.env.IP_HASH_SALT ?? "";
  return crypto.createHash("sha256").update(ip + salt).digest("hex").slice(0, 16);
}

function extractWhatsAppData(url: string): {
  inviteCode: string | null;
  universalLink: string;
} {
  const chatMatch = url.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/);
  if (chatMatch) {
    return {
      inviteCode: chatMatch[1],
      universalLink: url,
    };
  }

  return {
    inviteCode: null,
    universalLink: url,
  };
}

export default async function WhatsAppRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = admin();
  const h = await headers();

  const useragent = h.get("user-agent") ?? "";
  const referer = h.get("referer") ?? "";
  const ip = getIpFromHeaders(h);

  const { data: site } = await supabase
    .from("capture_sites")
    .select("id, title, whatsapp_url, button_color, active, expiresat, logopath")
    .eq("domain", DOMAIN)
    .eq("slug", slug)
    .maybeSingle();

  if (!site) return notFound();
  if (!site.active) return notFound();
  if (site.expiresat && new Date(site.expiresat) < new Date()) return notFound();

  try {
    const isbot = detectBot(useragent);
    const iphash = ip ? await hashIp(ip) : null;

    await supabase.from("capture_site_events").insert({
      site_id: site.id,
      event_type: "cta_click",
      iphash,
      useragent,
      referer,
      isbot,
    });
  } catch {
    // não interrompe
  }

  const { inviteCode, universalLink } = extractWhatsAppData(site.whatsapp_url);
  const title = site.title ?? "Grupo VIP";
  const buttonColor = site.button_color ?? "#90ee90";

  let logoUrl: string | null = null;
  if (site.logopath) {
    const { data } = supabase.storage
      .from(LOGO_BUCKET)
      .getPublicUrl(site.logopath);
    logoUrl = data.publicUrl ?? null;
  }

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        
        <script
          dangerouslySetInnerHTML={{
            __html: `
const hasGroup = true;
const inviteCode = ${JSON.stringify(inviteCode)};
const universalLink = ${JSON.stringify(universalLink)};

function showToast(msg) {
  var overlay = document.createElement("div");
  overlay.id = "app-toast-overlay";
  overlay.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);";
  var card = document.createElement("div");
  card.style.cssText = "max-width:360px;width:100%;background:#27272A;border:1px solid #27272A;border-radius:12px;padding:20px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);";
  var p = document.createElement("p");
  p.style.cssText = "margin:0 0 16px;font-size:14px;line-height:1.5;color:#E9E9E9;";
  p.textContent = msg;
  var btn = document.createElement("button");
  btn.textContent = "OK";
  btn.style.cssText = "width:100%;padding:10px 16px;background:#EE4D2D;color:#fff;border:none;border-radius:8px;font-weight:600;font-size:14px;cursor:pointer;";
  btn.onclick = function(){ var o = document.getElementById("app-toast-overlay"); if(o) o.remove(); };
  card.appendChild(p);
  card.appendChild(btn);
  overlay.appendChild(card);
  overlay.onclick = function(e){ if(e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

function enterGroup(){
  if (!hasGroup) return showToast("Grupo indisponível no momento.");
  window.location.href = "whatsapp://chat/?code=" + inviteCode;
  setTimeout(function(){ window.location.href = universalLink; }, 500);
}

function copyToClipboard(text){
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(function(){ showToast("Link copiado!"); })
      .catch(function(){ fallbackCopy(text); });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text){
  var input = document.createElement("input");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  input.setSelectionRange(0, 99999);
  try {
    document.execCommand("copy");
    showToast("Link copiado!");
  } catch(e) {
    showToast("Não foi possível copiar. Link: " + text);
  }
  document.body.removeChild(input);
}
            `,
          }}
        />
        
        <style>{`
          body {
            margin: 0;
            padding: 5vh 16px;
            font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 95vh;
            background: #f5f5f5;
            text-align: center;
            box-sizing: border-box;
          }
          .container {
            width: 100%;
            max-width: 400px;
            padding: 0 4px;
          }
          .logo-container {
            display: flex;
            justify-content: center;
            margin-bottom: 20px;
          }
          .logo-img {
            width: 200px;
            height: 200px;
            aspect-ratio: 1;
            object-fit: contain;
            background: rgba(3, 30, 13, 0.05);
            border-radius: 100%;
            cursor: pointer;
          }
          .title {
            font-size: 1.1rem;
            margin-bottom: 40px;
            font-weight: 600;
            color: #333;
            line-height: 1.4;
          }
          .actions {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .button {
            width: 100%;
            padding: 15px;
            font-size: 1.15rem;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
          }
          .button-primary {
            background: ${buttonColor};
            color: #000;
          }
          .button-primary:hover {
            opacity: 0.9;
            transform: scale(1.02);
          }
          .button-secondary {
            background: #f8f8f8;
            border: 1px solid #ccc;
            color: #333;
          }
          .button-secondary:hover {
            background: #e0e0e0;
          }
          .note {
            font-size: 0.75rem;
            color: #555;
            margin-top: 6px;
            line-height: 1.4;
          }
        `}</style>
      </head>

      <body
        dangerouslySetInnerHTML={{
          __html: `
<main class="container">
  <header class="logo-container">
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo-img" onclick="enterGroup()">` : '<div class="logo-img"></div>'}
  </header>

  <h1 class="title">Após clicar no botão abaixo, clique na opção &quot;CONTINUAR&quot;</h1>

  <div class="actions">
    <button class="button button-primary" onclick="enterGroup()">
      Entrar no grupo
    </button>

    <button class="button button-secondary" onclick="copyToClipboard('${universalLink}')">
      Copiar o link
    </button>

    <div class="note">
      Se não conseguir abrir, copie o link e cole em uma conversa.
    </div>
  </div>
</main>

<script>
/* AUTO OPEN segurado */
if (hasGroup) {
  try {
    setTimeout(() => (window.location.href = "whatsapp://chat/?code=" + inviteCode), 0);
  } catch(e){}
  setTimeout(() => window.location.replace(universalLink), 18000);
}
</script>
          `
        }}
      />
    </html>
  );
}
