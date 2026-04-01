export type PresetModel = { id: string; name: string; promptEn: string };

export const FEMALE_PRESETS: PresetModel[] = [
  { id: "brenda", name: "Brenda", promptEn: "Adult Brazilian woman, natural beauty, warm expression, relatable everyday look." },
  { id: "fatima", name: "Fatima", promptEn: "Adult Brazilian woman, elegant but casual, soft features, authentic smile." },
  { id: "larissa", name: "Larissa", promptEn: "Adult Brazilian woman, sporty-casual vibe, healthy skin, friendly eyes." },
  { id: "livia", name: "Livia", promptEn: "Adult Brazilian woman, minimalist style, subtle makeup, calm presence." },
  { id: "manuela", name: "Manuela", promptEn: "Adult Brazilian woman, curly hair, expressive, cozy home aesthetic." },
  { id: "marina", name: "Marina", promptEn: "Adult Brazilian woman, beach-city casual, sun-kissed natural skin." },
  { id: "melody", name: "Melody", promptEn: "Adult Brazilian woman, youthful adult, trendy but not influencer-perfect." },
  { id: "sofia", name: "Sofia", promptEn: "Adult Brazilian woman, straight dark hair, soft lighting on face, genuine." },
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
