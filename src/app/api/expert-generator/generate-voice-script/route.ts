import { NextResponse } from "next/server";
import { gateEspecialistaGenerate } from "@/lib/require-entitlements";
import { generateVoiceScriptWithGemini } from "@/lib/expert-generator/generate-voice-script-gemini";

export const maxDuration = 60;

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
  const productBrief =
    typeof b.productBrief === "string" ? b.productBrief.trim() : "";
  if (productBrief.length < 8) {
    return NextResponse.json(
      { error: "Descreva o produto com pelo menos 8 caracteres." },
      { status: 400 }
    );
  }

  const d = b.durationSeconds;
  const durationSeconds =
    d === 4 || d === 6 || d === 8 ? d : 6;

  const motionSummary =
    typeof b.motionSummary === "string" ? b.motionSummary.trim() : "";
  const voiceGender = b.voiceGender === "male" ? "male" : "female";

  const result = await generateVoiceScriptWithGemini({
    productBrief,
    durationSeconds,
    motionSummary,
    voiceGender,
  });

  if (!result.ok) {
    const isKey = /GEMINI_API_KEY|API key|PERMISSION_DENIED/i.test(
      result.error
    );
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: isKey ? 503 : 422 }
    );
  }

  return NextResponse.json({
    script: result.script,
    modelId: result.modelUsed,
  });
}
