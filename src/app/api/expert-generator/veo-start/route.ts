import { NextResponse } from "next/server";
import { gateGeradorCriativos } from "@/lib/require-entitlements";
import {
  buildExpertImagePrompt,
  buildExpertVideoPrompt,
  DEFAULT_IMAGE_PROMPT,
  DEFAULT_VIDEO_PROMPT,
  type ExpertImageBuildInput,
  type ExpertModelSelection,
  type ExpertVideoBuildInput,
} from "@/lib/expert-generator/build-prompt";
import { veoPredictLongRunning } from "@/lib/vertex/veo-long-running";

export const maxDuration = 60;

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
  const imageBase64 =
    typeof b.imageBase64 === "string" && b.imageBase64.length > 100
      ? b.imageBase64
      : "";
  const imageMimeType =
    typeof b.imageMimeType === "string" ? b.imageMimeType : "image/png";

  if (!imageBase64) {
    return NextResponse.json(
      { error: "imageBase64 da imagem gerada é obrigatório para o vídeo." },
      { status: 400 }
    );
  }

  const aspectRatio = b.aspectRatio === "16:9" ? "16:9" : "9:16";
  const durationSeconds = [4, 6, 8].includes(b.durationSeconds as number)
    ? (b.durationSeconds as 4 | 6 | 8)
    : 6;
  const resolution = b.resolution === "1080p" ? "1080p" : "720p";
  const voiceScript =
    typeof b.voiceScript === "string" ? b.voiceScript.trim() : "";
  const voiceGender = b.voiceGender === "male" ? "male" : "female";
  const generateAudio =
    voiceScript.length > 0 ? true : b.generateAudio === true;

  const advancedVideoPrompt =
    typeof b.advancedVideoPrompt === "string" && b.advancedVideoPrompt.trim()
      ? b.advancedVideoPrompt.trim()
      : DEFAULT_VIDEO_PROMPT;

  const advancedImagePrompt =
    typeof b.advancedImagePrompt === "string" && b.advancedImagePrompt.trim()
      ? b.advancedImagePrompt.trim()
      : DEFAULT_IMAGE_PROMPT;

  const optRaw = b.options;
  if (!optRaw || typeof optRaw !== "object") {
    return NextResponse.json({ error: "options é obrigatório" }, { status: 400 });
  }
  const opt = optRaw as Record<string, unknown>;
  const model = parseModel(opt.model);
  if (!model) {
    return NextResponse.json({ error: "model inválido" }, { status: 400 });
  }

  const asStringArray = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  const productDescription =
    typeof b.productDescription === "string" ? b.productDescription.trim() : "";
  const productVisionSummary =
    typeof b.productVisionSummary === "string" && b.productVisionSummary.trim()
      ? b.productVisionSummary.trim()
      : null;

  const productWearOnModel = opt.productWearOnModel === true;

  const imageBuild: ExpertImageBuildInput = {
    model,
    sceneIds: asStringArray(opt.sceneIds),
    sceneCustom: typeof opt.sceneCustom === "string" ? opt.sceneCustom : "",
    poseIds: asStringArray(opt.poseIds),
    poseCustom: typeof opt.poseCustom === "string" ? opt.poseCustom : "",
    styleIds: asStringArray(opt.styleIds),
    improvementIds: asStringArray(opt.improvementIds),
    productDescription: productDescription || undefined,
    productVisionSummary,
    productWearOnModel,
  };

  const videoBuild: ExpertVideoBuildInput = {
    ...imageBuild,
    motionIds: asStringArray(opt.motionIds),
    motionCustom: typeof opt.motionCustom === "string" ? opt.motionCustom : "",
    ...(voiceScript
      ? { voiceScript, voiceGender }
      : {}),
  };

  const imageContext = buildExpertImagePrompt(imageBuild, advancedImagePrompt);
  const videoPrompt = buildExpertVideoPrompt(videoBuild, advancedVideoPrompt);
  const combinedPrompt = `${videoPrompt}\n\n--- Static scene consistency ---\n${imageContext.slice(0, 6000)}`;

  try {
    const { name } = await veoPredictLongRunning({
      prompt: combinedPrompt,
      image: {
        bytesBase64Encoded: imageBase64,
        mimeType: imageMimeType,
      },
      aspectRatio,
      durationSeconds,
      resolution,
      generateAudio,
      sampleCount: 1,
      resizeMode: "pad",
    });

    return NextResponse.json({
      operationName: name,
      modelId: process.env.VERTEX_VEO_MODEL ?? "veo-3.1-fast-generate-001",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro Vertex Veo";
    console.error("expert-generator/veo-start", e);
    if (msg.includes("VERTEX_") || msg.includes("não configurado")) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
