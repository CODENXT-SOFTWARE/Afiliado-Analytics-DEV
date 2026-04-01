import { GoogleAuth } from "google-auth-library";

let cached: { token: string; exp: number } | null = null;
const SKEW_MS = 60_000;

/**
 * Lê credenciais da conta de serviço.
 * Preferir `VERTEX_SERVICE_ACCOUNT_JSON_BASE64` (ficheiro JSON em Base64) para evitar erros de escape no .env.
 */
function getServiceAccountCredentials(): Record<string, unknown> {
  const b64 = process.env.VERTEX_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (b64) {
    try {
      const json = Buffer.from(b64, "base64").toString("utf8");
      return JSON.parse(json) as Record<string, unknown>;
    } catch (e) {
      const hint =
        e instanceof Error ? e.message : "";
      throw new Error(
        `VERTEX_SERVICE_ACCOUNT_JSON_BASE64 inválido (Base64 ou JSON dentro do Base64). ${hint}`
      );
    }
  }

  let raw = process.env.VERTEX_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error(
      "Configure VERTEX_SERVICE_ACCOUNT_JSON (uma linha) ou VERTEX_SERVICE_ACCOUNT_JSON_BASE64 (ficheiro JSON em Base64)."
    );
  }
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    raw = raw.slice(1, -1).replace(/\\"/g, '"');
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (firstErr) {
    // Muita gente cola o Base64 do PowerShell em VERTEX_SERVICE_ACCOUNT_JSON por engano.
    const compact = raw.replace(/\s/g, "");
    const looksLikeBase64 =
      compact.length >= 80 && /^[A-Za-z0-9+/]+=*$/.test(compact);
    if (looksLikeBase64) {
      try {
        const decoded = Buffer.from(compact, "base64").toString("utf8");
        return JSON.parse(decoded) as Record<string, unknown>;
      } catch {
        /* continua para o erro abaixo */
      }
    }
    const hint =
      firstErr instanceof Error ? firstErr.message : "";
    throw new Error(
      `Credenciais Vertex: VERTEX_SERVICE_ACCOUNT_JSON não é JSON. Se usou PowerShell Base64, use a variável VERTEX_SERVICE_ACCOUNT_JSON_BASE64=... ou mantenha o Base64 nesta variável (agora também é aceite). Detalhe: ${hint}`
    );
  }
}

/** Token OAuth2 para chamadas REST ao Vertex (cloud-platform). */
export async function getVertexAccessToken(): Promise<string> {
  const now = Date.now();
  if (cached && cached.exp > now + SKEW_MS) {
    return cached.token;
  }

  const auth = new GoogleAuth({
    credentials: getServiceAccountCredentials(),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const res = await client.getAccessToken();
  const token = res.token;
  if (!token) {
    throw new Error("Não foi possível obter access token do Vertex.");
  }
  cached = { token, exp: now + 45 * 60 * 1000 };
  return token;
}

export function getVertexProjectId(): string {
  const id = process.env.VERTEX_PROJECT_ID?.trim();
  if (!id) {
    throw new Error("VERTEX_PROJECT_ID não configurado.");
  }
  return id;
}

export function getVertexLocation(): string {
  return process.env.VERTEX_LOCATION?.trim() || "us-central1";
}

export function getImagenModelId(): string {
  return (
    process.env.VERTEX_IMAGEN_MODEL?.trim() || "imagen-4.0-fast-generate-001"
  );
}

export function getVeoModelId(): string {
  return (
    process.env.VERTEX_VEO_MODEL?.trim() || "veo-3.1-fast-generate-001"
  );
}
