/**
 * Resume a foto do produto com Gemini (Google AI) para o prompt do Imagen (texto só).
 * Requer GEMINI_API_KEY (Google AI Studio).
 *
 * A REST API do Gemini usa camelCase nos JSON (inlineData, mimeType).
 * Opcional: GEMINI_VISION_MODEL (ex.: gemini-2.0-flash). Se falhar, tentamos modelos alternativos.
 */

const SYSTEM_INSTRUCTION = `You describe a product reference photo for a text-only image generator that CANNOT see pixels—only your words. The final image will show a REAL PERSON holding the item — your description must define ONLY the product in their hands, with absolute visual accuracy.

Write in English. Be literal, technical, and exhaustive. Any mistake in color, shape, proportion, or visible text is considered a failure.

----------------------------------------

CRITICAL OUTPUT FORMAT:
- Write 3–5 short paragraphs of natural prose ONLY.
- Do NOT use numbered lists, bullet points, section titles, or labels like "CATEGORY".
- Do NOT isolate words on separate lines (this can be mistaken as packaging text).
- Do NOT use ALL CAPS headings.
- Avoid formatting that looks like a template or form.

----------------------------------------

DESCRIPTION REQUIREMENTS (blend naturally into paragraphs):

Identify the product precisely and state the exact number of identical units visible (e.g., one bottle, two boxes).

Describe the physical structure with precision:
- Shape (cylindrical, rectangular, soft pouch, etc.)
- Proportions (tall vs wide, thick vs slim)
- Edges (rounded, sharp)
- Stability (flat base, curved, flexible)

Materials and surface behavior:
- Material type (plastic, glass, metal, paper, fabric, etc.)
- Finish (matte, glossy, semi-gloss, metallic, transparent, frosted)
- Light interaction (reflective highlights, soft diffusion, glare, fingerprints if visible)

Color fidelity (STRICT):
- Name the dominant color FIRST
- Then list secondary and accent colors
- Specify finish (e.g., matte black, glossy red, translucent amber)
- Mention gradients, fades, or color transitions if present

Label and layout:
- Label size relative to container (full wrap, front sticker, partial band)
- Alignment (centered, slightly rotated, off-center)
- Margins and spacing

Typography and text (CRITICAL):
- Transcribe ONLY visible text exactly as printed (case-sensitive)
- Maintain original spelling, spacing, and line breaks if obvious
- Describe font style (bold, thin, sans-serif, serif, condensed, wide)
- Describe hierarchy (large title, smaller subtitle, fine print)

Branding and symbols:
- Logo placement, size, and composition
- Icons, seals, badges, certification marks
- Lines, stripes, geometric accents, dividers

Micro-details (HIGH PRIORITY):
- Cap/lid type (screw cap, flip-top, pump, dropper)
- Cap texture (ribbed, smooth, metallic)
- Neck ring, safety seal, tamper band
- Barcodes, QR codes, small stamps, embossed marks

Orientation for rendering:
- Clearly describe how the product should be tilted or held so the main label faces the viewer directly and is fully readable.

----------------------------------------

STRICT RULES:
- Do NOT invent missing details
- If something is unclear, explicitly say it is unclear or partially visible
- Do NOT add marketing language or interpretation
- Focus purely on visual reality

----------------------------------------

MANDATORY FINAL LINE (DO NOT MODIFY FORMAT):

On a new line at the very end, output exactly:

LABEL_TEXT_TO_RENDER: "word1", "word2", "word3", ...

Rules for this line:
- Include ALL visible readable text from the product
- Each distinct text block must be in double quotes
- Preserve exact casing and wording
- Order from largest/most prominent to smallest
- Do NOT include anything that is not actually printed on the product

Maximum total length: ~400 words including the final line.`;

/** Mensagem do utilizador na chamada multimodal (imagem em seguida). Template literal evita erros de aspas com Prettier. */
const USER_PRODUCT_IMAGE_PROMPT = `You are a highly trained product analysis AI specialized in ultra-detailed visual inspection for e-commerce, branding, packaging design, and marketing intelligence.

Your task is to analyze the provided product image with extreme precision and describe EVERYTHING visible as if you were a professional product designer, photographer, and copywriter combined.

IMPORTANT RULES:
- Output ONLY in English
- Be extremely detailed, exhaustive, and structured
- Do NOT generalize — describe specifics
- Do NOT assume anything that is not visible
- If something is unclear, explicitly say it is unclear
- Treat this as a technical and visual audit, not a simple description

----------------------------------------

VISUAL ANALYSIS CHECKLIST (FOLLOW STRICTLY):

1. GENERAL OVERVIEW
- What is the product?
- Category and possible use
- First visual impression
- Perceived quality level (premium, cheap, etc.)
- Style (modern, minimalist, vintage, etc.)

2. COLORS (VERY IMPORTANT)
- List ALL colors present
- Describe dominant and secondary colors
- Include gradients, reflections, shadows
- Mention finish: matte, glossy, metallic, transparent, etc.

3. MATERIALS & TEXTURES
- Identify materials (plastic, glass, metal, paper, fabric, etc.)
- Surface details (smooth, rough, embossed, reflective, etc.)
- Light interaction (shiny, diffused, mirror-like, etc.)

4. SHAPE & STRUCTURE
- Overall shape (cylindrical, rectangular, organic, etc.)
- Edges (sharp, rounded)
- Proportions and geometry
- Symmetry or asymmetry

5. PACKAGING DETAILS
- Type of packaging (box, bottle, pouch, etc.)
- Structure and opening mechanism
- Visible seals, lids, caps, or closures
- Protective elements

6. TEXT & TYPOGRAPHY (CRITICAL)
- Transcribe ALL visible text EXACTLY as shown
- Fonts (serif, sans-serif, handwritten, bold, thin)
- Text hierarchy (titles, subtitles, small print)
- Alignment and spacing

7. LOGO & BRANDING
- Describe logo position, size, and style
- Colors and shapes used in branding
- Brand consistency across the product
- Any icons or symbols

8. GRAPHICS & DESIGN ELEMENTS
- Patterns, illustrations, icons
- Background textures or images
- Decorative elements
- Visual composition

9. DIMENSIONS & SCALE (ESTIMATION)
- Estimate size based on proportions
- Relative thickness, height, width
- Ergonomics (easy to hold, bulky, compact, etc.)

10. CONDITION & QUALITY
- New or used appearance
- Visible imperfections (scratches, dents, dust)
- Manufacturing precision

11. LIGHTING & PHOTOGRAPHY CONTEXT
- Lighting type (studio, natural, artificial)
- Shadows and highlights
- Background (plain, textured, environment)
- Camera angle and framing

12. MARKETING INTERPRETATION
- Target audience
- Product positioning (luxury, budget, niche)
- Emotional impression (clean, powerful, elegant, fun, etc.)

----------------------------------------

OUTPUT FORMAT:

Return the answer in the following structured format:

- Title: (short product title)
- Category:
- Description:
- Detailed Visual Breakdown:
   • Colors:
   • Materials:
   • Shape:
   • Packaging:
   • Text:
   • Branding:
   • Graphics:
   • Size Estimate:
   • Condition:
   • Photography Context:
- Marketing Insight:

----------------------------------------

Now analyze the image with maximum detail and precision. Also respect the system instructions (including LABEL_TEXT_TO_RENDER if required).`;


/** Modelos a tentar por ordem (o primeiro disponível na tua chave ganha). */
const DEFAULT_MODEL_CANDIDATES = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-preview-05-20",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
] as const;

export type DescribeProductResult =
  | { ok: true; description: string; modelUsed: string }
  | { ok: false; error: string; detail?: string; modelTried?: string };

type GeminiGenerateResponse = {
  error?: { message?: string; code?: number; status?: string };
  promptFeedback?: { blockReason?: string };
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string }[] };
  }[];
};

function collectTextFromResponse(json: GeminiGenerateResponse): string {
  const texts: string[] = [];
  for (const c of json.candidates ?? []) {
    for (const p of c.content?.parts ?? []) {
      if (typeof p.text === "string" && p.text.trim()) {
        texts.push(p.text.trim());
      }
    }
  }
  return texts.join("\n").trim();
}

function explainEmptyResponse(json: GeminiGenerateResponse): string {
  const block = json.promptFeedback?.blockReason;
  if (block) {
    return `Pedido bloqueado pelo Gemini (promptFeedback.blockReason: ${block}). Tente outra foto ou descreva o produto à mão.`;
  }
  const c0 = json.candidates?.[0];
  if (c0?.finishReason && c0.finishReason !== "STOP") {
    return `Resposta sem texto (finishReason: ${c0.finishReason}).`;
  }
  if (!json.candidates?.length) {
    return "O Gemini não devolveu candidatos (lista vazia). Verifique o modelo e a chave.";
  }
  return "O Gemini devolveu uma resposta sem texto utilizável.";
}

function safetySettingsPayload() {
  const categories = [
    "HARM_CATEGORY_HARASSMENT",
    "HARM_CATEGORY_HATE_SPEECH",
    "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    "HARM_CATEGORY_DANGEROUS_CONTENT",
  ] as const;
  return categories.map((category) => ({
    category,
    threshold: "BLOCK_ONLY_HIGH",
  }));
}

function buildRequestBody(mimeType: string, base64Data: string) {
  return {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: USER_PRODUCT_IMAGE_PROMPT,
          },
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.12, maxOutputTokens: 1400 },
    safetySettings: safetySettingsPayload(),
  };
}

async function generateOnce(
  model: string,
  apiKey: string,
  mimeType: string,
  base64Data: string,
): Promise<DescribeProductResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = buildRequestBody(mimeType, base64Data);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: GeminiGenerateResponse;
  try {
    json = JSON.parse(text) as GeminiGenerateResponse;
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
      json.error?.message ?? `HTTP ${res.status} ao chamar o modelo ${model}.`;
    return {
      ok: false,
      error: msg,
      detail: json.error?.status,
      modelTried: model,
    };
  }

  const out = collectTextFromResponse(json);
  if (out) {
    return { ok: true, description: out, modelUsed: model };
  }

  return {
    ok: false,
    error: explainEmptyResponse(json),
    detail: text.slice(0, 800),
    modelTried: model,
  };
}

export async function describeProductWithGemini(
  mimeType: string,
  base64Data: string,
): Promise<DescribeProductResult> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: "GEMINI_API_KEY não configurada." };
  }

  const envModel = process.env.GEMINI_VISION_MODEL?.trim();
  const candidates = envModel
    ? [envModel, ...DEFAULT_MODEL_CANDIDATES.filter((m) => m !== envModel)]
    : [...DEFAULT_MODEL_CANDIDATES];

  const errors: string[] = [];
  for (const model of candidates) {
    const result = await generateOnce(model, key, mimeType, base64Data);
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
      "Nenhum modelo Gemini conseguiu descrever a imagem. Verifique GEMINI_API_KEY e tente GEMINI_VISION_MODEL (ex.: gemini-2.0-flash).",
    detail: errors.join("\n"),
  };
}

/** Compatível com código que só precisa de string | null. */
export async function describeProductWithGeminiOrNull(
  mimeType: string,
  base64Data: string,
): Promise<string | null> {
  const r = await describeProductWithGemini(mimeType, base64Data);
  return r.ok ? r.description : null;
}
