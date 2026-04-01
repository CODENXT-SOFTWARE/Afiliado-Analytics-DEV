import {
  FEMALE_PRESETS,
  IMPROVEMENT_CHIPS,
  MALE_PRESETS,
  POSE_CHIPS,
  SCENE_CHIPS,
  STYLE_CHIPS,
  VIDEO_MOTION_CHIPS,
} from "./constants";

/**
 * Templates do passo 3 (prompt avançado no UI). Chaves `{NOME}` são substituídas no servidor
 * pelas escolhas do formulário e pela descrição/análise do produto.
 *
 * Chaves suportadas:
 * `{MODEL_GENDER}`, `{MODEL_DESCRIPTION}`, `{PRODUCT_REFERENCE_IMAGE}`, `{SCENE_DESCRIPTION}`,
 * `{CUSTOM_SCENE}`, `{POSE_DESCRIPTION}`, `{STYLE_DESCRIPTION}`, `{IMPROVEMENT_DESCRIPTION}`,
 * `{MOVEMENT_DESCRIPTION}` (vídeo; em imagem estática usa texto neutro se existir no template).
 * `{PRODUCT_USE_BODY}` — bloco “segurar vs vestir” + referência do produto (preenchido no servidor).
 * `{VIDEO_SEED_PRODUCT_PHRASE}`, `{VIDEO_PRODUCT_MOTION_HINT}` — continuidade no vídeo conforme vestir/segurar.
 */
export const DEFAULT_IMAGE_PROMPT = `NOT a product packshot — NOT a bottle alone on a backdrop. Ultra-realistic Brazilian UGC — ONE lifestyle photograph with person + place + product.

WHO YOU MUST SHOW (non-negotiable): a real adult Brazilian {MODEL_GENDER}, appearance: {MODEL_DESCRIPTION}. This person is the MAIN subject and must occupy a large share of the frame (face and/or upper body visible per pose — never omit the human unless the pose explicitly allows hands-only with visible skin). They stand or sit in: {SCENE_DESCRIPTION}. Custom scene notes: {CUSTOM_SCENE}. Pose: {POSE_DESCRIPTION}. Wardrobe / vibe: {STYLE_DESCRIPTION}. Quality notes: {IMPROVEMENT_DESCRIPTION}.

{PRODUCT_USE_BODY}

LABEL AND TYPOGRAPHY (mandatory — common failure mode): If the specification describes a printed label, bands, logos, or words on packaging OR printed graphics/text on fabric or garments, you MUST render them on the actual product surface facing the camera (bottle, box, fabric, etc.). Do NOT output blank undecorated surfaces where graphics were described. Every string listed after LABEL_TEXT_TO_RENDER in the spec must appear as real print on the product, not as floating subtitles in the air. Shallow depth of field is OK on the background, but branded/print areas must be sharp enough to read. A smooth empty cylinder or plain tee when the spec mentions logos, bands, or artwork is an invalid output.

Hard bans: fake phone UI, status bar, app chrome, story/reels frame, watermarks, gibberish UI text. Full-bleed photo like a camera-roll file. Brazilian everyday authenticity — no mansion glam kitchen.`;

export const DEFAULT_VIDEO_PROMPT = `Ultra-realistic Brazilian UGC vertical video — one continuous take feel.

The FIRST FRAME you receive is already the full scene: the same {MODEL_GENDER} ({MODEL_DESCRIPTION}), environment ({SCENE_DESCRIPTION}; custom: {CUSTOM_SCENE}), pose ({POSE_DESCRIPTION}), style ({STYLE_DESCRIPTION}), {VIDEO_SEED_PRODUCT_PHRASE} EXTEND that moment in time — do not replace it with a product-only intro, packshot B-roll, or a cut to “just the bottle” before the person appears. No slideshow: no shot that is only the SKU on white, then a different shot with the person. Same human, same clothes, same room, same product appearance for the whole clip.

Product identity (text spec — keep identical motion-to-motion; graphics must stay visible and legible, not blank surfaces): {PRODUCT_REFERENCE_IMAGE}

Movement: {MOVEMENT_DESCRIPTION}. Handheld micro-shake, imperfect framing, natural light for the scene. The {MODEL_GENDER} talks or reacts like recommending to a friend; {VIDEO_PRODUCT_MOTION_HINT} Quality: {IMPROVEMENT_DESCRIPTION}.

Hard bans: fake phone UI, status bar, story chrome, watermarks, social headers. Plain full-bleed footage like camera roll. Photoreal Brazilian UGC — not a TV ad.`;

export type ExpertModelSelection =
  | { mode: "preset"; presetId: string; gender: "women" | "men" }
  | { mode: "custom"; description: string; gender: "women" | "men" };

export type ExpertImageBuildInput = {
  model: ExpertModelSelection;
  sceneIds: string[];
  sceneCustom?: string;
  poseIds: string[];
  poseCustom?: string;
  styleIds: string[];
  improvementIds: string[];
  productDescription?: string;
  productVisionSummary?: string | null;
  /**
   * Nano Banana (Gemini Image): a foto do produto vai no mesmo pedido multimodal.
   * Ajusta STEP 1 e `{PRODUCT_REFERENCE_IMAGE}` para não depender só de texto.
   */
  productImageAttachedForNanoBanana?: boolean;
  /**
   * `true` = produto vestível no corpo (ex.: camisa). `false`/omitido = segurar nas mãos (padrão).
   */
  productWearOnModel?: boolean;
};

export type ExpertVideoBuildInput = ExpertImageBuildInput & {
  motionIds: string[];
  motionCustom?: string;
  voiceScript?: string;
  voiceGender?: "female" | "male";
};

function presetById(gender: "women" | "men", id: string) {
  const list = gender === "women" ? FEMALE_PRESETS : MALE_PRESETS;
  return list.find((p) => p.id === id);
}

function joinFragments(ids: string[], defs: { id: string; promptEn: string }[]) {
  const parts = ids
    .map((id) => defs.find((d) => d.id === id)?.promptEn)
    .filter(Boolean) as string[];
  return parts.join(" ");
}

function normalizeForDedupe(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function splitVisionAndUserNotes(
  vision: string | null | undefined,
  userNotes: string | null | undefined
): { visionOnly: string | null; userOnly: string | null } {
  const v = vision?.trim() || "";
  const u = userNotes?.trim() || "";
  if (!v && !u) return { visionOnly: null, userOnly: null };
  if (!v) return { visionOnly: null, userOnly: u };
  if (!u) return { visionOnly: v, userOnly: null };
  const nv = normalizeForDedupe(v);
  const nu = normalizeForDedupe(u);
  if (nv === nu || nv.includes(nu) || nu.includes(nv)) {
    return { visionOnly: v, userOnly: null };
  }
  return { visionOnly: v, userOnly: u };
}

function modelGenderWord(gender: "women" | "men"): string {
  return gender === "women" ? "woman" : "man";
}

function wearMode(input: ExpertImageBuildInput): boolean {
  return input.productWearOnModel === true;
}

/** Remove cabeçalhos tipo "2) CONTAINER / FORM" que o Gemini antigo punha no texto e o Imagen imprimia no rótulo. */
function sanitizeGeminiOutlineBleed(text: string): string {
  const lines = text.split(/\r?\n/);
  const kept = lines.filter((line) => {
    const t = line.trim();
    if (!t) return true;
    if (/^\d{1,2}\)\s+[A-Z][A-Z0-9\s/&\-—]+(\s*—|\s*$)/i.test(t)) return false;
    return true;
  });
  const out = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  // Se o Gemini só devolver linhas no formato de outline, o filtro pode esvaziar tudo — manter o original.
  if (!out && text.trim()) return text.trim();
  return out;
}

/** Texto do produto para `{PRODUCT_REFERENCE_IMAGE}`: análise Gemini + notas do utilizador. */
function buildProductReferenceForTemplate(input: ExpertImageBuildInput): string {
  const { visionOnly, userOnly } = splitVisionAndUserNotes(
    input.productVisionSummary,
    input.productDescription
  );
  const chunks: string[] = [];
  if (visionOnly) chunks.push(sanitizeGeminiOutlineBleed(visionOnly));
  if (userOnly) chunks.push(sanitizeGeminiOutlineBleed(userOnly));
  const merged = chunks.join("\n\n").trim();
  if (!merged) {
    if (input.productImageAttachedForNanoBanana) {
      if (wearMode(input)) {
        return (
          "[WEARABLE PRODUCT — match the attached product reference image in this request]\n" +
          "The garment or wearable's cut, colors, graphics, neckline, sleeves, and fabric read are visible in the product image. Reproduce it naturally worn on the presenter’s body with believable fit and drape — do not invent a different item and do not show only a flat folded shirt unless the scene explicitly calls for that."
        );
      }
      return (
        "[OBJECT IN HANDS — match the attached product reference image in this request]\n" +
        "The exact pack (silhouette, label layout, colors, cap, typography, materials, unit count) is visible in the product image supplied with this prompt. Reproduce that same SKU in the presenter’s hands — do not invent a substitute product."
      );
    }
    return wearMode(input)
      ? "Use STEP 1 product text above — reproduce that exact wearable on the presenter's body."
      : "Use STEP 1 product text above — reproduce that exact pack in the presenter's hands only.";
  }
  if (wearMode(input)) {
    return (
      "[WEARABLE ON BODY — not the whole photograph; match every detail below]\n" +
      merged
    );
  }
  return (
    "[OBJECT IN HANDS — not the whole photograph; match every detail below]\n" +
    merged
  );
}

/** Bloco STEP 3 substituído em `{PRODUCT_USE_BODY}` (inclui já o texto de `{PRODUCT_REFERENCE_IMAGE}` resolvido). */
function buildProductUseBodyForImageTemplate(
  input: ExpertImageBuildInput,
  productRef: string
): string {
  const g = modelGenderWord(input.model.gender);
  if (wearMode(input)) {
    return [
      `WHAT THEY WEAR (must match spec, not “similar”): the product must be visibly ON THE PRESENTER'S BODY — believable fit, drape, seams, neckline/sleeves as appropriate, and any print/graphics exactly as in the reference. Do NOT default to holding the item stretched toward the camera like a bottle unless it is clearly not apparel. Ground truth is the text below and, when a product reference image is included in the same generation request, that image for exact garment identity:`,
      "",
      productRef,
      "",
      "Do NOT output a packshot of clothing alone on a hanger or flat lay as the entire frame without the person. Do NOT fill the frame with only the garment on a plain backdrop and no wearer. The correct output is always: environment + visible presenter + product worn on the body in one shot.",
      "",
      `The ${g} faces or angles toward the camera as in the pose; the worn product must read clearly (torso, shoulders, sleeves, or full outfit as appropriate). Casual UGC energy — not a glossy catalog lookbook.`,
      "",
      "Photorealistic: a Brazilian creator showing how the piece looks on them — person first, garment clearly visible and faithful to the reference.",
    ].join("\n");
  }
  return [
    `WHAT THEY HOLD (must match spec, not “similar”): the product is ONLY the object in their hands. Follow this product specification literally — same silhouette, colors, label layout, logo, typography, cap, material finish, and unit count. Ground truth is the text below and, when a product reference image is included in the same generation request, that image for exact pack identity:`,
    "",
    productRef,
    "",
    "Do NOT output a packshot, catalog tile, or “reference image” of the product alone. Do NOT fill the frame with only the packaging on a plain or studio background. Do NOT paste or recreate the user's upload as the entire picture. The correct output is always: environment + visible presenter + product in hands together in one shot.",
    "",
    `The ${g} faces or angles toward the camera as in the pose, presenting the product at arm's length or chest height so the label stays readable. Casual UGC energy — not a glossy ad. Lighting matches the scene (sun outdoors, warm indoors, gym fluorescents, etc.). Natural skin, hair, fabric; phone-camera selfie / front-camera look, slight grain.`,
    "",
    "Photorealistic: a Brazilian creator showing a friend what they bought — person first, product clearly in the same frame.",
  ].join("\n");
}

function buildModelDescriptionForTemplate(input: ExpertImageBuildInput): string {
  if (input.model.mode === "preset") {
    const p = presetById(input.model.gender, input.model.presetId);
    return p?.promptEn ?? "Adult Brazilian person, believable everyday look.";
  }
  const d = input.model.description.trim();
  return d || "Adult Brazilian person, believable everyday look.";
}

function buildSceneDescriptionForTemplate(input: ExpertImageBuildInput): string {
  const fromChips = joinFragments(input.sceneIds, SCENE_CHIPS);
  const custom = input.sceneCustom?.trim();
  if (fromChips) return fromChips;
  if (custom) return custom;
  return "Everyday Brazilian setting, imperfect and lived-in.";
}

/** Notas extra de cena só quando há chips + texto — evita duplicar no preâmbulo se a cena for só texto livre. */
function sceneCustomAdditionalForPreamble(input: ExpertImageBuildInput): string {
  const fromChips = joinFragments(input.sceneIds, SCENE_CHIPS);
  const custom = input.sceneCustom?.trim();
  if (fromChips && custom) return custom;
  return "";
}

function buildPoseDescriptionForTemplate(input: ExpertImageBuildInput): string {
  const pose = joinFragments(input.poseIds, POSE_CHIPS);
  const custom = input.poseCustom?.trim();
  if (pose && custom) return `${pose} ${custom}`;
  if (custom && !pose) return custom;
  return pose || "Natural candid framing toward the camera.";
}

function buildStyleDescriptionForTemplate(input: ExpertImageBuildInput): string {
  return joinFragments(input.styleIds, STYLE_CHIPS) || "Casual everyday Brazilian clothing.";
}

function buildImprovementDescriptionForTemplate(input: ExpertImageBuildInput): string {
  const imp = joinFragments(input.improvementIds, IMPROVEMENT_CHIPS);
  return imp || "Standard quality — no extra enhancement chips selected.";
}

export type FillExpertTemplateExtras = {
  /** Só vídeo: texto derivado dos chips de movimento + notas. */
  motionDescription?: string;
};

/**
 * Substitui `{CHAVE}` no template pelos valores do UI + produto.
 * Chaves desconhecidas mantêm-se literais para o utilizador poder usar texto próprio.
 */
export function fillExpertPromptTemplate(
  template: string,
  input: ExpertImageBuildInput,
  extras?: FillExpertTemplateExtras
): string {
  const motionFromVideo =
    extras?.motionDescription?.trim() ||
    (() => {
      const v = input as ExpertVideoBuildInput;
      const ids = v.motionIds ?? [];
      if (!ids.length && !v.motionCustom?.trim()) return "";
      const m = joinFragments(ids, VIDEO_MOTION_CHIPS);
      const c = v.motionCustom?.trim();
      return [m, c].filter(Boolean).join(" ");
    })();

  const sceneFromChips = joinFragments(input.sceneIds, SCENE_CHIPS);
  const sceneCustomTrim = input.sceneCustom?.trim() || "";
  const customSceneSlot =
    sceneFromChips && sceneCustomTrim
      ? sceneCustomTrim
      : !sceneFromChips && sceneCustomTrim
        ? "—"
        : "not specified — use only the main scene type above";

  const productRefBlock = buildProductReferenceForTemplate(input);
  const videoSeedPhrase = wearMode(input)
    ? "already wearing the product on their body (garment or wearable as in the seed frame)."
    : "holding the product.";
  const videoMotionHint = wearMode(input)
    ? "the worn product stays clearly visible on the body (fit, print, drape)."
    : "product stays visible in hand.";

  const map: Record<string, string> = {
    MODEL_GENDER: modelGenderWord(input.model.gender),
    MODEL_DESCRIPTION: buildModelDescriptionForTemplate(input),
    PRODUCT_REFERENCE_IMAGE: productRefBlock,
    PRODUCT_USE_BODY: buildProductUseBodyForImageTemplate(input, productRefBlock),
    VIDEO_SEED_PRODUCT_PHRASE: videoSeedPhrase,
    VIDEO_PRODUCT_MOTION_HINT: videoMotionHint,
    SCENE_DESCRIPTION: buildSceneDescriptionForTemplate(input),
    CUSTOM_SCENE: customSceneSlot,
    POSE_DESCRIPTION: buildPoseDescriptionForTemplate(input),
    STYLE_DESCRIPTION: buildStyleDescriptionForTemplate(input),
    IMPROVEMENT_DESCRIPTION: buildImprovementDescriptionForTemplate(input),
    MOVEMENT_DESCRIPTION:
      motionFromVideo ||
      "subtle handheld micro-movement while presenting the product (still frame context)",
  };

  let out = template;
  for (const [key, value] of Object.entries(map)) {
    out = out.split(`{${key}}`).join(value);
  }
  return out;
}

/**
 * Vai no TOPO do prompt — o Imagen dá peso ao início; se STEP 1 (produto) vier primeiro,
 * o modelo tende a gerar só packshot. Isto fixa pessoa + cenário antes dos detalhes do pack.
 */
function buildImagePromptPreamble(input: ExpertImageBuildInput): string {
  const g = modelGenderWord(input.model.gender);
  const modelDesc = buildModelDescriptionForTemplate(input);
  const scene = buildSceneDescriptionForTemplate(input);
  const sceneExtra = sceneCustomAdditionalForPreamble(input);
  const pose = buildPoseDescriptionForTemplate(input);
  const line3 = wearMode(input)
    ? `(3) That person clearly WEARING the product on their body (appearance matches STEP 1) — pose intent: ${pose}`
    : `(3) That person holding the product toward the camera — pose intent: ${pose}`;
  const rightLine = wearMode(input)
    ? "RIGHT: the person and the room (or outdoor place) are clearly visible; the product is worn ON THEIR BODY (fit, drape, graphics) — not a clothing-only packshot without the wearer."
    : "RIGHT: the person and the room (or outdoor place) are clearly visible; the product is an object IN THEIR HANDS, not the sole subject of the image.";
  const step1Hint = wearMode(input)
    ? "The paragraphs below labeled STEP 1 describe the product to wear (garment, accessory, etc.) — they are NOT instructions to output only that item as the full image without the human and scene."
    : "The paragraphs below labeled STEP 1 describe ONLY the packaging to place in the person's hands — they are NOT instructions to draw only that packaging as the full image.";
  return [
    ">>> START — OUTPUT TYPE (HIGHEST PRIORITY) <<<",
    `You must generate ONE photorealistic UGC-style photograph that includes ALL of the following in the SAME frame:`,
    `(1) A real adult Brazilian ${g} — ${modelDesc}`,
    `(2) A real environment (not a void): ${scene}${sceneExtra ? ` Additional: ${sceneExtra}.` : ""}`,
    line3,
    "",
    "WRONG (do not generate): a photograph of ONLY the product on a plain black, gray, or white background with NO visible human body, NO face, NO arms — that is a catalog packshot and is rejected.",
    rightLine,
    step1Hint,
    ">>> END PREAMBLE <<<",
  ].join("\n");
}

/** Passo 1: o que a IA “leu” da foto do produto + o que o utilizador escreveu. */
function buildStep1ProductFromImage(input: ExpertImageBuildInput): string {
  const { visionOnly, userOnly } = splitVisionAndUserNotes(
    input.productVisionSummary,
    input.productDescription
  );

  const step1Title = wearMode(input)
    ? "STEP 1 — WEARABLE PRODUCT (text for the item on the presenter's body — NOT a description of the whole photograph)."
    : "STEP 1 — HAND-HELD PRODUCT PROP ONLY (text for the object in the person's hands — NOT a description of the whole photograph).";
  const lines: string[] = [
    step1Title,
    "Ignore the temptation to output only this object: the final image must still show the human presenter and the scene from STEP 2.",
  ];

  if (input.productImageAttachedForNanoBanana) {
    lines.push(
      "MULTIMODAL: A reference photo of the product is attached in this same API request. Use it as the ground truth for packaging identity (shape, label, colors, typography, cap, materials). STEP 2 defines the human, scene, pose, and style — apply both."
    );
  } else {
    lines.push(
      "The image generator does not see pixels—only this text. Match packaging, colors, branding, logos, and materials exactly—never substitute a generic white bottle or wrong colors if the description says black, red, textile, etc."
    );
  }

  if (visionOnly) {
    lines.push(
      `Automated analysis of the product photo:\n${sanitizeGeminiOutlineBleed(visionOnly)}`
    );
  } else if (!userOnly) {
    lines.push(
      input.productImageAttachedForNanoBanana
        ? "No extra written product spec — rely on the attached product reference image for exact SKU appearance."
        : "(No product description yet—add a photo analysis or type details in the app.)"
    );
  }

  if (userOnly) {
    lines.push(
      `User notes (override conflicts—if these disagree with automated analysis, follow the user):\n${sanitizeGeminiOutlineBleed(userOnly)}`
    );
  }

  lines.push(
    "Reproduce THIS product category and look—not a random substitute. If the product is fabric, show fabric; if jars, show those jars."
  );

  lines.push(
    "IDENTITY LOCK: Preserve exact brand spelling, logo geometry, label color blocks, cap/closure color, material (matte vs gloss), and number of identical units visible in the spec — “close enough” is wrong; mismatch is failure."
  );

  lines.push(
    wearMode(input)
      ? "ROLE IN OUTPUT: The product must appear as worn by the human presenter in the lifestyle scene (fit and identity match STEP 1). The final image must never be a packshot of the garment alone on a plain surface without the wearer and environment from STEP 2."
      : "ROLE IN OUTPUT: The product exists only as the item the human presenter holds in the lifestyle scene. The final image must never be a packshot of the product alone without the scene and presenter described in STEP 2."
  );

  lines.push(
    "LABEL RENDERING: If the description mentions text, brand, colored bands, or graphics on the pack, the generated product MUST show a real printed label with those elements — never an undecorated blank container. Follow any LABEL_TEXT_TO_RENDER line from the analysis: those quoted strings must appear on the physical label in the image."
  );

  return lines.join("\n\n");
}

/** Passo 2: modelo, cena, pose, estilo e melhorias escolhidos no UI. */
function buildStep2AppSelections(input: ExpertImageBuildInput): string {
  const blocks: string[] = [
    "STEP 2 — USER CHOICES FROM THE APP (apply every line below).",
    wearMode(input)
      ? "Product interaction (from app): WORN on the presenter's body — do not default to holding it like a bottle unless the product is not apparel."
      : "Product interaction (from app): HELD in the presenter's hands.",
  ];

  if (input.model.mode === "preset") {
    const p = presetById(input.model.gender, input.model.presetId);
    if (p) {
      // Sem nomes internos/preset — o Imagen às vezes “imprime” esse texto na imagem.
      blocks.push(`Person appearance: ${p.promptEn}`);
    }
  } else {
    const d = input.model.description.trim();
    if (d) {
      blocks.push(`Model (custom description): ${d}`);
    }
  }

  const sceneChips = joinFragments(input.sceneIds, SCENE_CHIPS);
  const sceneCustom = input.sceneCustom?.trim();
  if (sceneChips) {
    blocks.push(`Setting / scene: ${sceneChips}`);
    if (sceneCustom) {
      blocks.push(`Extra scene detail: ${sceneCustom}`);
    }
  } else if (sceneCustom) {
    blocks.push(`Setting / scene (custom): ${sceneCustom}`);
  }

  const poseChips = joinFragments(input.poseIds, POSE_CHIPS);
  const poseCustom = input.poseCustom?.trim();
  if (poseChips) {
    blocks.push(`Pose / framing: ${poseChips}`);
    if (poseCustom) {
      blocks.push(`Extra pose detail: ${poseCustom}`);
    }
  } else if (poseCustom) {
    blocks.push(`Pose / framing (custom): ${poseCustom}`);
  }

  const style = joinFragments(input.styleIds, STYLE_CHIPS);
  if (style) {
    blocks.push(`Wardrobe / style: ${style}`);
  }

  const imp = joinFragments(input.improvementIds, IMPROVEMENT_CHIPS);
  if (imp) {
    blocks.push(`Enhancements: ${imp}`);
  }

  return blocks.join("\n\n");
}

/** Núcleo criativo: passo 1 + 2 (reutilizado na imagem e no contexto de vídeo). */
export function buildExpertCreativeCore(input: ExpertImageBuildInput): string {
  return `${buildStep1ProductFromImage(input)}\n\n${buildStep2AppSelections(input)}`;
}

function buildImageCompositionGuarantee(input: ExpertImageBuildInput): string {
  const productForward = input.poseIds.includes("so-produto");
  const humanLine =
    productForward && wearMode(input)
      ? "Even in product-forward framing: real skin and body must show the product worn — never disembodied fabric with zero human context."
      : productForward
        ? "Even in product-forward framing: real hands and forearms with natural skin must hold the product — never a floating pack with zero human."
        : "The presenter's face and/or upper body must read clearly per STEP 2 pose — the specialist is mandatory, not optional.";
  const productLine = wearMode(input)
    ? "(3) product worn on the body per STEP 1."
    : "(3) product in hands per STEP 1.";
  return [
    "COMPOSITION GUARANTEE (repeat — equal priority to STEP 3):",
    "Final image = one photorealistic Brazilian UGC photograph with ALL of: (1) environment from STEP 2, (2) visible adult " +
      modelGenderWord(input.model.gender) +
      " per model description, " +
      productLine,
    humanLine,
    "FORBIDDEN: product-only; supplement bottle alone on dark gradient; Amazon-style packshot; white/gray/black seamless with zero human; macro product fill with no room context; any frame with no visible skin or body parts.",
    "FORBIDDEN: blank / unprinted packaging when STEP 1 describes a label — the bottle or box must show the described graphics and text on its surface.",
  ].join("\n");
}

function buildVideoContinuityGuarantee(): string {
  return [
    "VIDEO CONTINUITY GUARANTEE:",
    "The seed image is already the full composition (person + place + product). Motion must continue that same shot.",
    "Do not start with a product-only beat and then cut to the presenter; do not fade from packshot to person. One coherent UGC clip.",
  ].join("\n");
}

function extractLabelTextToRenderLine(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const line = text.split(/\r?\n/).find((l) => l.trim().startsWith("LABEL_TEXT_TO_RENDER:"));
  return line?.trim() ?? null;
}

/** Repete a linha LABEL no fim do prompt — o Imagen tende a obedecer melhor ao texto recente. */
function buildLabelTypographyPunch(input: ExpertImageBuildInput): string {
  const blob = [input.productVisionSummary, input.productDescription].filter(Boolean).join("\n");
  const line = extractLabelTextToRenderLine(blob);
  if (!line) {
    return "";
  }
  return [
    ">>> LABEL TYPOGRAPHY — APPLY ON THE PACK SURFACE (not optional) <<<",
    line,
    "Paint these as printed label graphics on the product; do not leave the pack blank.",
    ">>> END LABEL <<<",
  ].join("\n");
}

function buildImagePromptClosingReminder(input: ExpertImageBuildInput): string {
  const g = modelGenderWord(input.model.gender);
  const actionLine = wearMode(input)
    ? `Show a Brazilian ${g} in the chosen environment, clearly visible, wearing the specified product on the body — not a clothing-only still life without the person.`
    : `Show a Brazilian ${g} in the chosen environment, clearly visible, holding the specified product — not a standalone bottle or jar photograph.`;
  const labelLine = wearMode(input)
    ? "If graphics or branding were described on fabric, they must appear on the garment — not blank cloth."
    : "If a label was described, the pack must show that label — not plain white plastic.";
  return [
    ">>> FINAL REMINDER BEFORE RENDER <<<",
    actionLine,
    labelLine,
    ">>> END <<<",
  ].join("\n");
}

/** Se o utilizador apagou `{PRODUCT_REFERENCE_IMAGE}` do prompt avançado, o produto ainda entra aqui. */
function ensureProductSpecInFilledTemplate(
  originalTemplate: string,
  filledStep3: string,
  input: ExpertImageBuildInput
): string {
  if (originalTemplate.includes("{PRODUCT_REFERENCE_IMAGE}")) {
    return filledStep3;
  }
  const spec = buildProductReferenceForTemplate(input);
  return (
    filledStep3 +
    "\n\n--- PRODUCT WRITTEN SPEC (included automatically — add {PRODUCT_REFERENCE_IMAGE} to your advanced prompt to place this block yourself) ---\n" +
    spec
  );
}

export function buildExpertImagePrompt(
  input: ExpertImageBuildInput,
  basePromptTemplate: string
): string {
  const rawTemplate = basePromptTemplate.trim();
  let filledStep3 = fillExpertPromptTemplate(rawTemplate, input);
  filledStep3 = ensureProductSpecInFilledTemplate(rawTemplate, filledStep3, input);
  const step3 = `STEP 3 — RENDERING (template filled from UI + product text)\n${filledStep3}`;
  return [
    buildImagePromptPreamble(input),
    "",
    buildExpertCreativeCore(input),
    "",
    buildImageCompositionGuarantee(input),
    "",
    step3,
    "",
    buildLabelTypographyPunch(input),
    "",
    buildImagePromptClosingReminder(input),
  ]
    .filter((s) => s !== "")
    .join("\n")
    .trim();
}

export function buildExpertVideoPrompt(
  input: ExpertVideoBuildInput,
  baseVideoPromptTemplate: string
): string {
  const motion = joinFragments(input.motionIds, VIDEO_MOTION_CHIPS);
  const motionDesc = [motion, input.motionCustom?.trim()].filter(Boolean).join(" ");
  const rawVideo = baseVideoPromptTemplate.trim();
  let filledStep3 = fillExpertPromptTemplate(rawVideo, input, {
    motionDescription: motionDesc || undefined,
  });
  filledStep3 = ensureProductSpecInFilledTemplate(rawVideo, filledStep3, input);
  const labelPunch = buildLabelTypographyPunch(input);
  const parts = [
    buildExpertCreativeCore(input),
    `\n${buildVideoContinuityGuarantee()}`,
    `\nSTEP 3 — VIDEO RENDERING (template filled from UI + product text)\n${filledStep3}`,
    labelPunch ? `\n${labelPunch}` : "",
    wearMode(input)
      ? "\nKeep continuity with the reference frame: same person, outfit, product worn on the body, environment — animate in place, do not reset to a new composition. Keep garment graphics visible — not blank fabric."
      : "\nKeep continuity with the reference frame: same person, outfit, product in hand, environment — animate in place, do not reset to a new composition. Keep label graphics visible — not blank packaging.",
  ];
  const script = input.voiceScript?.trim();
  if (script) {
    const g =
      input.voiceGender === "male"
        ? "warm adult male Brazilian voice"
        : "warm adult female Brazilian voice";
    parts.push(
      `\nSpeech: Brazilian Portuguese, ${g}, natural lip movement. Script: "${script.replace(/"/g, "'")}"`
    );
  }
  return parts.join("").trim();
}
