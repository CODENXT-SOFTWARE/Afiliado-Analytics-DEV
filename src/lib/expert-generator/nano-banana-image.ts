/**
 * Geração de imagem via Gemini Image (“Nano Banana”) — Google AI (GEMINI_API_KEY).
 * Multimodal: texto completo (mesmo prompt que o Vertex) + foto do produto opcional.
 *
 * Modelos: https://ai.google.dev/gemini-api/docs/image-generation
 * - `gemini-2.5-flash-image` (Nano Banana)
 * - `gemini-3.1-flash-image-preview` (Nano Banana 2)
 */

const DEFAULT_MODEL_CANDIDATES = [
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image-preview",
] as const;

const MULTIMODAL_INTRO = `The image below is ONLY a product reference (packaging, label, colors, shape). Match it faithfully in the generated scene.
Do NOT output this reference as the full final picture — create a NEW photorealistic photograph that follows the instructions after the separator.

---

`;

export type NanoBananaImageResult =
  | { ok: true; imageBase64: string; mimeType: string; modelUsed: string }
  | { ok: false; error: string; detail?: string; modelTried?: string };

type GeminiImagePart = {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  /** Algumas respostas REST usam snake_case. */
  inline_data?: { mime_type?: string; data?: string };
};

type GeminiImageResponse = {
  error?: { message?: string; code?: number; status?: string };
  promptFeedback?: { blockReason?: string };
  candidates?: {
    finishReason?: string;
    content?: { parts?: GeminiImagePart[] };
  }[];
};

function collectFirstInlineImage(json: GeminiImageResponse): {
  mimeType: string;
  data: string;
} | null {
  for (const c of json.candidates ?? []) {
    for (const p of c.content?.parts ?? []) {
      const id = p.inlineData;
      if (id?.data && typeof id.data === "string") {
        return {
          mimeType: id.mimeType?.trim() || "image/png",
          data: id.data,
        };
      }
      const snake = p.inline_data;
      if (snake?.data && typeof snake.data === "string") {
        return {
          mimeType: snake.mime_type?.trim() || "image/png",
          data: snake.data,
        };
      }
    }
  }
  return null;
}

function explainImageFailure(json: GeminiImageResponse, raw: string): string {
  const block = json.promptFeedback?.blockReason;
  if (block) {
    return `Pedido bloqueado (promptFeedback.blockReason: ${block}).`;
  }
  const c0 = json.candidates?.[0];
  if (c0?.finishReason && c0.finishReason !== "STOP") {
    return `Sem imagem utilizável (finishReason: ${c0.finishReason}).`;
  }
  if (!json.candidates?.length) {
    return "O Gemini não devolveu candidatos.";
  }
  if (json.error?.message) {
    return json.error.message;
  }
  return `Resposta sem imagem inline. ${raw.slice(0, 400)}`;
}

function normalizeAspectRatio(ar: string): string {
  const t = ar.trim();
  const allowed = new Set([
    "1:1",
    "2:3",
    "3:2",
    "3:4",
    "4:3",
    "4:5",
    "5:4",
    "9:16",
    "16:9",
    "21:9",
  ]);
  if (allowed.has(t)) return t;
  return "9:16";
}

function buildBody(
  promptText: string,
  aspectRatio: string,
  productImageBase64: string | null,
  productMimeType: string
) {
  const parts: GeminiImagePart[] = [];
  if (productImageBase64) {
    parts.push({ text: MULTIMODAL_INTRO + promptText });
    parts.push({
      inlineData: {
        mimeType: productMimeType || "image/jpeg",
        data: productImageBase64,
      },
    });
  } else {
    parts.push({ text: promptText });
  }

  return {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: normalizeAspectRatio(aspectRatio),
      },
    },
  };
}

async function generateOnce(
  model: string,
  apiKey: string,
  promptText: string,
  aspectRatio: string,
  productImageBase64: string | null,
  productMimeType: string
): Promise<NanoBananaImageResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = buildBody(promptText, aspectRatio, productImageBase64, productMimeType);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: GeminiImageResponse;
  try {
    json = JSON.parse(text) as GeminiImageResponse;
  } catch {
    return {
      ok: false,
      error: "Resposta inválida do Gemini (não é JSON).",
      detail: text.slice(0, 500),
      modelTried: model,
    };
  }

  if (!res.ok) {
    const msg =
      json.error?.message ?? `HTTP ${res.status} ao chamar ${model}.`;
    return {
      ok: false,
      error: msg,
      detail: json.error?.status,
      modelTried: model,
    };
  }

  const img = collectFirstInlineImage(json);
  if (img) {
    return {
      ok: true,
      imageBase64: img.data,
      mimeType: img.mimeType,
      modelUsed: model,
    };
  }

  return {
    ok: false,
    error: explainImageFailure(json, text),
    detail: text.slice(0, 800),
    modelTried: model,
  };
}

export async function generateNanoBananaImage(params: {
  prompt: string;
  aspectRatio: string;
  productImageBase64: string | null;
  productMimeType: string;
}): Promise<NanoBananaImageResult> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: "GEMINI_API_KEY não configurada (necessária para Nano Banana / Gemini Image)." };
  }

  const envModel = process.env.GEMINI_NANO_BANANA_MODEL?.trim();
  const candidates = envModel
    ? [envModel, ...DEFAULT_MODEL_CANDIDATES.filter((m) => m !== envModel)]
    : [...DEFAULT_MODEL_CANDIDATES];

  const errors: string[] = [];
  const promptText = params.prompt.trim();
  if (!promptText) {
    return { ok: false, error: "Prompt vazio." };
  }

  for (const model of candidates) {
    const result = await generateOnce(
      model,
      key,
      promptText,
      params.aspectRatio,
      params.productImageBase64,
      params.productMimeType
    );
    if (result.ok) return result;
    errors.push(`[${model}] ${result.error}`);
    if (
      /API key not valid|invalid api key|PERMISSION_DENIED/i.test(result.error)
    ) {
      return result;
    }
  }

  return {
    ok: false,
    error:
      "Nenhum modelo Gemini Image gerou imagem. Verifique GEMINI_API_KEY e opcionalmente GEMINI_NANO_BANANA_MODEL (ex.: gemini-2.5-flash-image).",
    detail: errors.join("\n"),
  };
}
