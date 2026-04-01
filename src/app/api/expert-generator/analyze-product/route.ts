import { NextResponse } from "next/server";
import { gateGeradorCriativos } from "@/lib/require-entitlements";
import { describeProductWithGemini } from "@/lib/expert-generator/describe-product-gemini";

export const maxDuration = 60;

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

/**
 * Analisa a foto do produto com Gemini e devolve texto para preencher o campo
 * de descrição no frontend (antes de gerar com Imagen).
 */
export async function POST(req: Request) {
  const gate = await gateGeradorCriativos();
  if (!gate.allowed) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const productImageBase64 =
    typeof b.productImageBase64 === "string" ? b.productImageBase64 : "";
  const productMimeType =
    typeof b.productMimeType === "string" && b.productMimeType.trim()
      ? b.productMimeType.trim()
      : "image/jpeg";

  if (!productImageBase64) {
    return NextResponse.json(
      { error: "productImageBase64 é obrigatório" },
      { status: 400 }
    );
  }

  const approxBytes = (productImageBase64.length * 3) / 4;
  if (approxBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Imagem muito grande (máx. ~12MB)." },
      { status: 400 }
    );
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY não configurada. Defina no .env.local para analisar a foto do produto.",
      },
      { status: 503 }
    );
  }

  try {
    const result = await describeProductWithGemini(
      productMimeType,
      productImageBase64
    );
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          detail: result.detail,
          modelTried: result.modelTried,
        },
        { status: 422 }
      );
    }
    return NextResponse.json({
      description: result.description,
      modelUsed: result.modelUsed,
    });
  } catch (e) {
    console.error("expert-generator/analyze-product", e);
    const msg = e instanceof Error ? e.message : "Erro ao analisar produto";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
