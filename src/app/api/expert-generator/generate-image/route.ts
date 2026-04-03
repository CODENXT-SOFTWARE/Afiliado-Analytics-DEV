import { NextResponse } from "next/server";
import { gateEspecialistaGenerate } from "@/lib/require-entitlements";
import {
  buildExpertImagePrompt,
  DEFAULT_IMAGE_PROMPT,
  type ExpertImageBuildInput,
  type ExpertModelSelection,
} from "@/lib/expert-generator/build-prompt";
import { FEMALE_PRESETS, MALE_PRESETS } from "@/lib/expert-generator/constants";
import { loadPresetReferenceImages } from "@/lib/expert-generator/load-preset-reference-images";
import { generateNanoBananaImage } from "@/lib/expert-generator/nano-banana-image";

export const maxDuration = 120;

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_CUSTOM_FACE_REFS = 6;
const MAX_CUSTOM_FACE_BYTES = 5 * 1024 * 1024;

function parseCustomFaceReferenceImages(
  opt: Record<string, unknown>
): { mimeType: string; base64: string }[] {
  const raw = opt.customFaceReferenceImages;
  if (!Array.isArray(raw)) return [];
  const out: { mimeType: string; base64: string }[] = [];
  for (const item of raw) {
    if (out.length >= MAX_CUSTOM_FACE_REFS) break;
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const mimeType = typeof o.mimeType === "string" ? o.mimeType.trim() : "";
    const base64 =
      typeof o.base64 === "string" ? o.base64.replace(/\s/g, "") : "";
    if (!/^image\/(jpeg|png|webp)$/i.test(mimeType)) continue;
    if (base64.length < 80) continue;
    const approxBytes = (base64.length * 3) / 4;
    if (approxBytes > MAX_CUSTOM_FACE_BYTES) continue;
    out.push({ mimeType: mimeType.toLowerCase(), base64 });
  }
  return out;
}

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
  const gate = await gateEspecialistaGenerate();
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

  const customFaceRefs = parseCustomFaceReferenceImages(opt);

  if (
    model.mode === "custom" &&
    model.description.trim().length < 8 &&
    customFaceRefs.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "Descreva a pessoa (mín. 8 caracteres) ou envie pelo menos uma foto de referência facial.",
      },
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

  const hasProductPhoto = Boolean(productImageBase64);

  const productWearOnModel = opt.productWearOnModel === true;

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
    productImageAttachedForNanoBanana: hasProductPhoto,
    productWearOnModel,
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

  // Não incluir nomes de API/modelo no prompt — o modelo tende a “imprimir” esse texto na imagem.
  const finalPrompt = buildExpertImagePrompt(buildInput, advancedImagePrompt);

  let modelReferenceImages: { mimeType: string; base64: string }[] = [];
  if (model.mode === "preset") {
    const list = model.gender === "women" ? FEMALE_PRESETS : MALE_PRESETS;
    const packId = list.find((p) => p.id === model.presetId)?.referencePackId;
    if (packId) {
      modelReferenceImages = loadPresetReferenceImages(packId);
    }
  } else if (model.mode === "custom" && customFaceRefs.length > 0) {
    modelReferenceImages = customFaceRefs;
  }

  const nb = await generateNanoBananaImage({
    prompt: finalPrompt,
    aspectRatio,
    productImageBase64: productImageBase64 || null,
    productMimeType,
    modelReferenceImages,
    productWearOnModel,
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
    productVisionSummary: productDescription || null,
    modelId: nb.modelUsed,
    imageProvider: "nano-banana" as const,
    /** Confirmação para o UI: fotos de rosto enviadas no pedido multimodal ao Gemini Image. */
    modelFaceReferenceCount: modelReferenceImages.length,
  });
}
