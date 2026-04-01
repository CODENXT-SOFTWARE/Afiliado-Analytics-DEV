import { NextResponse } from "next/server";
import { gateGeradorCriativos } from "@/lib/require-entitlements";
import {
  buildExpertImagePrompt,
  DEFAULT_IMAGE_PROMPT,
  type ExpertImageBuildInput,
  type ExpertModelSelection,
} from "@/lib/expert-generator/build-prompt";
import { describeProductWithGeminiOrNull } from "@/lib/expert-generator/describe-product-gemini";
import { FEMALE_PRESETS, MALE_PRESETS } from "@/lib/expert-generator/constants";
import { imagenPredict } from "@/lib/vertex/imagen-predict";
import { generateNanoBananaImage } from "@/lib/expert-generator/nano-banana-image";

export const maxDuration = 120;

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function parseModel(raw: unknown): ExpertModelSelection | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const gender = o.gender === "men" ? "men" : o.gender === "women" ? "women" : null;
  if (!gender) return null;
  if (o.mode === "custom") {
    const description = typeof o.description === "string" ? o.description : "";
    return { mode: "custom", description, gender };
  }
  if (o.mode === "preset" && typeof o.presetId === "string") {
    return { mode: "preset", presetId: o.presetId, gender };
  }
  return null;
}

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
  const advancedImagePrompt =
    typeof b.advancedImagePrompt === "string" && b.advancedImagePrompt.trim()
      ? b.advancedImagePrompt.trim()
      : DEFAULT_IMAGE_PROMPT;

  const aspectRatio =
    typeof b.aspectRatio === "string" && b.aspectRatio.trim()
      ? b.aspectRatio.trim()
      : "9:16";

  const productImageBase64 =
    typeof b.productImageBase64 === "string" ? b.productImageBase64 : "";
  const productMimeType =
    typeof b.productMimeType === "string" ? b.productMimeType : "image/jpeg";
  const productDescription =
    typeof b.productDescription === "string" ? b.productDescription.trim() : "";
  /** Texto da análise (ou do campo) enviado pelo cliente — usado se o Gemini no servidor falhar ou devolver null. */
  const clientProductVisionSummary =
    typeof b.productVisionSummary === "string" && b.productVisionSummary.trim()
      ? b.productVisionSummary.trim()
      : null;

  const imageProvider =
    b.imageProvider === "nano-banana" ? "nano-banana" : "vertex";

  if (productImageBase64) {
    const approxBytes = (productImageBase64.length * 3) / 4;
    if (approxBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Imagem do produto muito grande (máx. ~12MB)." },
        { status: 400 }
      );
    }
  }

  const optRaw = b.options;
  if (!optRaw || typeof optRaw !== "object") {
    return NextResponse.json({ error: "options é obrigatório" }, { status: 400 });
  }
  const opt = optRaw as Record<string, unknown>;

  const model = parseModel(opt.model);
  if (!model) {
    return NextResponse.json({ error: "model inválido" }, { status: 400 });
  }

  if (model.mode === "custom" && model.description.trim().length < 8) {
    return NextResponse.json(
      { error: "Descreva a modelo em “Criar do Zero” (mín. 8 caracteres)." },
      { status: 400 }
    );
  }

  if (model.mode === "preset") {
    const list = model.gender === "women" ? FEMALE_PRESETS : MALE_PRESETS;
    if (!list.some((p) => p.id === model.presetId)) {
      return NextResponse.json({ error: "presetId inválido" }, { status: 400 });
    }
  }

  const asStringArray = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  const nanoWithProductPhoto =
    imageProvider === "nano-banana" && Boolean(productImageBase64);

  const buildInput: ExpertImageBuildInput = {
    model,
    sceneIds: asStringArray(opt.sceneIds),
    sceneCustom: typeof opt.sceneCustom === "string" ? opt.sceneCustom : "",
    poseIds: asStringArray(opt.poseIds),
    poseCustom: typeof opt.poseCustom === "string" ? opt.poseCustom : "",
    styleIds: asStringArray(opt.styleIds),
    improvementIds: asStringArray(opt.improvementIds),
    productDescription: productDescription || undefined,
    productVisionSummary: null,
    productImageAttachedForNanoBanana: nanoWithProductPhoto,
  };

  if (!productImageBase64 && productDescription.length < 15) {
    return NextResponse.json(
      {
        error:
          "Envie a foto do produto ou escreva uma descrição do produto (mín. 15 caracteres).",
      },
      { status: 400 }
    );
  }

  /** Com Nano Banana + foto, o modelo vê pixels — não gastamos chamada Gemini só para descrever o produto. */
  let visionSummary: string | null = null;
  if (productImageBase64 && !nanoWithProductPhoto) {
    try {
      visionSummary = await describeProductWithGeminiOrNull(
        productMimeType,
        productImageBase64
      );
    } catch (e) {
      console.warn("describeProductWithGeminiOrNull", e);
    }
  }
  const mergedVision = visionSummary ?? clientProductVisionSummary;
  buildInput.productVisionSummary = mergedVision;

  // Não incluir nomes de API/modelo no prompt — o Imagen tende a “imprimir” esse texto na imagem.
  const finalPrompt = buildExpertImagePrompt(buildInput, advancedImagePrompt);

  if (imageProvider === "nano-banana") {
    const nb = await generateNanoBananaImage({
      prompt: finalPrompt,
      aspectRatio,
      productImageBase64: productImageBase64 || null,
      productMimeType,
    });
    if (!nb.ok) {
      const isKey = /GEMINI_API_KEY não configurada/i.test(nb.error);
      const quota =
        /quota|free_tier|exceeded your current quota|billing/i.test(
          `${nb.error}\n${nb.detail ?? ""}`
        );
      return NextResponse.json(
        {
          error: nb.error,
          detail: nb.detail,
          hint: quota
            ? "Os modelos Gemini Image (Nano Banana) exigem projeto com faturamento ativo (pay-as-you-go); no tier gratuito o limite destes modelos costuma ser 0. No Google AI Studio, associe o projeto à conta de faturamento e confirme o tier em Faturamento. Documentação: https://ai.google.dev/gemini-api/docs/rate-limits"
            : isKey
              ? "Configure GEMINI_API_KEY (Google AI Studio) no servidor. Opcional: GEMINI_NANO_BANANA_MODEL (ex.: gemini-2.5-flash-image)."
              : undefined,
        },
        { status: isKey ? 503 : 422 }
      );
    }
    return NextResponse.json({
      mimeType: nb.mimeType,
      imageBase64: nb.imageBase64,
      promptUsed: finalPrompt,
      productVisionSummary: mergedVision,
      modelId: nb.modelUsed,
      imageProvider: "nano-banana" as const,
    });
  }

  try {
    const predictions = await imagenPredict({
      prompt: finalPrompt,
      sampleCount: 1,
      aspectRatio,
      language: "en",
      personGeneration: "allow_adult",
    });

    const first = predictions[0];
    if (!first?.bytesBase64Encoded) {
      const reason = first?.raiFilteredReason ?? "Sem imagem na resposta (RAI ou erro).";
      return NextResponse.json({ error: reason }, { status: 422 });
    }

    return NextResponse.json({
      mimeType: first.mimeType ?? "image/png",
      imageBase64: first.bytesBase64Encoded,
      promptUsed: finalPrompt,
      productVisionSummary: mergedVision,
      modelId: process.env.VERTEX_IMAGEN_MODEL ?? "imagen-4.0-fast-generate-001",
      imageProvider: "vertex" as const,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro Vertex Imagen";
    console.error("expert-generator/generate-image", e);
    if (msg.includes("VERTEX_") || msg.includes("não configurado") || msg.includes("Configure VERTEX")) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    const statusCode =
      e instanceof Error && "statusCode" in e && typeof (e as { statusCode: unknown }).statusCode === "number"
        ? (e as { statusCode: number }).statusCode
        : 502;
    if (statusCode === 401 || statusCode === 403) {
      return NextResponse.json(
        {
          error: msg,
          hint: "Verifique o papel «Usuário da Vertex AI» na conta de serviço e se a Vertex AI API está ativa no projeto.",
        },
        { status: 403 }
      );
    }
    if (statusCode === 404) {
      return NextResponse.json(
        {
          error: msg,
          hint: "Modelo ou região incorretos. Tente VERTEX_LOCATION=us-central1 e confira VERTEX_IMAGEN_MODEL na documentação Google.",
        },
        { status: 404 }
      );
    }
    if (statusCode >= 400 && statusCode < 500) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
