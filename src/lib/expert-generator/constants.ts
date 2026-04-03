export type PresetModel = {
  id: string;
  name: string;
  promptEn: string;
  /**
   * Pasta `src/lib/expert-generator/expert/<referencePackId>/` com PNG/JPEG/WebP
   * enviados ao Nano Banana como referência facial (mesma pessoa).
   */
  referencePackId?: string;
};

export const FEMALE_PRESETS: PresetModel[] = [
  {
    id: "milena",
    name: "Milena",
    referencePackId: "milena",
    promptEn:
      "Adult woman — same facial identity as the reference face photos: long voluminous dark brown to black wavy hair, center part, warm tan skin, light brown eyes, defined arched brows, natural makeup with neutral lips, soft confident expression. Often wears a simple black V-neck top. Photoreal Brazilian UGC in the final shot — not catalog studio beauty, not a different face.",
  },
  {
    id: "miko",
    name: "Miko",
    referencePackId: "miko",
    promptEn:
      "Adult woman — same facial identity as the reference face photos: straight jet-black hair in a chin-length bob with full straight-across bangs, oval face, light-to-medium clear skin, almond brown eyes, full natural lips, calm direct gaze. Black long-sleeve top with scoop neckline and delicate black lace trim; thin black choker with small silver cylindrical pendant; small dark script-style tattoo on upper chest below collarbone (keep if visible in framing). Photoreal Brazilian UGC — not a different face.",
  },
  {
    id: "camille",
    name: "Camille",
    referencePackId: "camille",
    promptEn:
      "Adult woman — same facial identity as the reference face photos: long wavy dark brown hair with soft curtain bangs, light-to-medium skin with natural freckles on nose and cheeks, brown eyes, subtle winged eyeliner, full lips natural pink-nude tone, calm confident expression. Often wears black high-neck top with black blazer; small gold hoop earrings and thin gold necklace with small round pendant. Photoreal UGC, not catalog beauty.",
  },
  {
    id: "maria",
    name: "Maria",
    referencePackId: "maria",
    promptEn:
      "Adult woman — same facial identity as the reference face photos: shoulder-length to medium dark chestnut brown hair with soft natural waves, side or center part, warm olive to tan skin, brown eyes, soft brows, natural makeup with warm nude lips, friendly approachable expression. Often wears a simple black or dark top. Photoreal Brazilian UGC — not a different face, not catalog beauty.",
  },
  {
    id: "sophia",
    name: "Sophia",
    referencePackId: "sophia",
    promptEn:
      "Adult woman — same facial identity as the reference face photos: long straight to lightly wavy dark blonde or light brown hair, side part, fair to light-medium skin, hazel or light brown eyes, defined but natural brows, minimal makeup, calm confident gaze. Often wears black or neutral dark top. Photoreal Brazilian UGC — not a different face.",
  },
  {
    id: "rosa",
    name: "Rosa",
    referencePackId: "rosa",
    promptEn:
      "Adult woman — same facial identity as the reference face photos: natural medium-to-long curly or coily dark brown hair, volume at crown, warm brown skin, dark brown eyes, full brows, subtle glossy lips, warm smile. Simple black top or dark casual wear; small gold jewelry ok if in references. Photoreal Brazilian UGC — not a different face.",
  },
  {
    id: "luana",
    name: "Luana",
    referencePackId: "luana",
    promptEn:
      "Adult woman — same facial identity as the reference face photos: long sleek dark brown to black hair, often down or sleek ponytail, tan skin, dark almond eyes, groomed brows, natural makeup, confident relaxed expression. Black fitted top or dark casual clothing. Photoreal Brazilian UGC — not a different face.",
  },
  {
    id: "evy",
    name: "Evy",
    referencePackId: "evy",
    promptEn:
      "Adult woman — same facial identity as the reference face photos: short dark hair in pixie or cropped cut, light to medium skin (freckles if visible in refs), expressive eyes, soft natural makeup, subtle smile. Black simple top. Photoreal Brazilian UGC — not a different face.",
  },
];

export const MALE_PRESETS: PresetModel[] = [
  { id: "andre", name: "André", promptEn: "Adult Brazilian man, casual street style, short hair, approachable." },
  { id: "bruno", name: "Bruno", promptEn: "Adult Brazilian man, athletic build, simple t-shirt, natural skin texture." },
  { id: "caio", name: "Caio", promptEn: "Adult Brazilian man, light stubble, warm smile, everyday apartment vibe." },
  { id: "diego", name: "Diego", promptEn: "Adult Brazilian man, curly hair, creative casual look, candid posture." },
  { id: "felipe", name: "Felipe", promptEn: "Adult Brazilian man, clean shave, office-casual, believable customer." },
  { id: "gustavo", name: "Gustavo", promptEn: "Adult Brazilian man, broader build, simple clothes, real-life proportions." },
  { id: "lucas", name: "Lucas", promptEn: "Adult Brazilian man, younger adult, hoodie or tee, natural hair." },
  { id: "rafael", name: "Rafael", promptEn: "Adult Brazilian man, medium beard, confident but not model posing." },
];

export const SCENE_CHIPS: { id: string; label: string; promptEn: string }[] = [
  { id: "casa", label: "Casa", promptEn: "Scene in a typical Brazilian home or apartment: lived-in, simple furniture, common objects, not a catalog interior." },
  { id: "estudio", label: "Estúdio", promptEn: "Small informal studio corner in a Brazilian home (NOT a professional white cyclorama): soft clutter, real walls, imperfect backdrop." },
  { id: "arlivre", label: "Ar livre", promptEn: "Outdoor everyday Brazilian setting: sidewalk, residential street, small business front, or balcony with real city/neighborhood context." },
  { id: "academia", label: "Academia", promptEn: "SETTING IS A GYM ONLY: interior of a Brazilian fitness center or gym — rubber or tiled floor, weight machines, dumbbells, benches, mirrors, other people possible in background. NOT a home, NOT a balcony, NOT a living room, NOT a kitchen. The person may wear workout clothes." },
  { id: "cozinha", label: "Cozinha", promptEn: "Brazilian kitchen: practical layout, everyday appliances, normal countertops, no American-showroom kitchen." },
  { id: "outros", label: "Outros", promptEn: "Everyday Brazilian context left open; keep environment imperfect and believable." },
];

export const POSE_CHIPS: { id: string; label: string; promptEn: string }[] = [
  { id: "frente", label: "De frente", promptEn: "Frontal candid framing, slight asymmetry, not symmetrical ad pose." },
  { id: "selfie", label: "Selfie", promptEn: "Arm-length selfie angle, slight lens distortion, natural face distance." },
  { id: "pov", label: "POV", promptEn: "POV-style first-person handheld perspective of interacting with the product." },
  { id: "mirror", label: "Mirror selfie", promptEn: "Casual mirror selfie in a normal Brazilian bathroom or bedroom mirror, slight grime or real mirror imperfections ok." },
  { id: "sentada", label: "Sentada", promptEn: "Sitting naturally on sofa or chair, relaxed posture, not staged." },
  { id: "so-produto", label: "Só produto", promptEn: "Product-forward composition with minimal visible person (hands/arms only if needed), still lifestyle not packshot studio." },
];

export const STYLE_CHIPS: { id: string; label: string; promptEn: string }[] = [
  { id: "casual", label: "Casual", promptEn: "Casual everyday Brazilian clothing, simple fabrics." },
  { id: "profissional", label: "Profissional", promptEn: "Smart-casual Brazilian office or small business look, not luxury suit catalog." },
  { id: "esportivo", label: "Esportivo", promptEn: "Sporty casual activewear, realistic sweat and texture ok." },
  { id: "elegante", label: "Elegante", promptEn: "Understated elegance for a normal outing, not red-carpet styling." },
  { id: "minimalista", label: "Minimalista", promptEn: "Minimal wardrobe and background clutter, still human and imperfect." },
  { id: "streetwear", label: "Streetwear", promptEn: "Urban Brazilian streetwear, believable local fashion." },
  { id: "boho", label: "Boho", promptEn: "Light boho touches, natural fibers, not festival glam." },
  { id: "suave", label: "Suave", promptEn: "Soft tones, gentle expressions, cozy mood." },
  { id: "colorido", label: "Colorido", promptEn: "Naturally colorful everyday clothes and environment, not neon pop-art." },
  { id: "verao", label: "Verão", promptEn: "Warm weather Brazilian vibe, humidity-realistic hair and skin." },
  { id: "trendy", label: "Trendy", promptEn: "Current but normal-person trends, not influencer perfection." },
  { id: "estetico", label: "Estético", promptEn: "Soft aesthetic mood while staying photoreal and non-advertisement." },
];

export const IMPROVEMENT_CHIPS: { id: string; label: string; promptEn: string }[] = [
  { id: "skin", label: "Skin Enhancer", promptEn: "Keep realistic skin texture with visible pores and small imperfections; avoid plastic skin." },
  { id: "luz", label: "Luz ambiente", promptEn: "Natural ambient light mixing with practical indoor lamps where appropriate." },
  { id: "nitidez", label: "Ultra nitidez", promptEn: "Crisp but smartphone-realistic sharpness, not oversharpened CGI." },
  { id: "anti-ia", label: "Anti-IA", promptEn: "Avoid AI-artifacts: no extra fingers, no melted objects, coherent physics." },
  { id: "bokeh", label: "Bokeh Pro", promptEn: "Natural smartphone shallow depth, gentle background blur, not cinematic anamorphic." },
  { id: "maos", label: "Mãos perfeitas", promptEn: "Anatomically correct hands interacting naturally with the product." },
  { id: "cabelo", label: "Cabelo real", promptEn: "Individual hair strands, flyaways, realistic Brazilian hair textures." },
  { id: "tecido", label: "Tecido real", promptEn: "Fabric folds, wrinkles, and weave visible; believable material response." },
  { id: "brilho", label: "Brilho natural", promptEn: "Natural specular highlights on skin and product, not beauty-gloss overlay." },
];

export const VIDEO_MOTION_CHIPS: { id: string; label: string; promptEn: string }[] = [
  { id: "micro", label: "Micro movimento", promptEn: "Subtle handheld micro-movement, breathing, tiny head shift." },
  { id: "uso", label: "Usando o produto", promptEn: "Short believable action: testing, applying, wearing, or operating the product." },
  { id: "ambiente", label: "Ambiente vivo", promptEn: "Background has slight real life motion (fan, curtain, distant people blur)." },
  { id: "story", label: "Estilo story", promptEn: "Vertical phone story pacing, quick natural moment, not trailer cuts." },
];
