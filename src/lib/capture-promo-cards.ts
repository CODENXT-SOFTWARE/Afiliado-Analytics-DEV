import type { PageTemplate } from "@/app/(main)/dashboard/captura/_lib/types";
import { defaultRosaIconKeyForIndex, normalizeRosaIconKey, type VipRosaIconKey } from "@/lib/capture-promo-icons";

const L = {
  rosaTitle: 90,
  rosaBody: 260,
  terroTitle: 90,
  terroBody: 220,
  terroEmoji: 12,
  aurName: 48,
  aurCity: 48,
  aurQuote: 320,
  line: 160,
} as const;

export const PROMO_ROSA_MIN = 1;
export const PROMO_ROSA_MAX = 12;
export const PROMO_TERRO_MIN = 1;
export const PROMO_TERRO_MAX = 12;
export const PROMO_AURORA_MIN = 1;
export const PROMO_AURORA_MAX = 8;
export const PROMO_SIMPLE_MIN = 1;
export const PROMO_SIMPLE_MAX = 12;

export type VipRosaCardRow = {
  title: string;
  body: string;
  iconKey: VipRosaIconKey;
  /** Se não vazio, substitui o ícone na página. */
  emoji: string;
};

export type VipTerrosoCardRow = { emoji: string; title: string; body: string };

export type AuroraCardRow = {
  name: string;
  city: string;
  quote: string;
  /** Path no bucket `capture-logos` (ex.: userId/siteId/promo-avatars/...). */
  avatar_path: string | null;
};

export const VIP_ROSA_CARD_DEFAULTS: { title: string; body: string }[] = [
  {
    title: "Cupons que funcionam",
    body: "Cupons testados e atualizados pra você economizar na finalização da compra.",
  },
  {
    title: "Casa e decoração",
    body: "Organização, cozinha, utilidades e decoração com preço bom e qualidade.",
  },
  {
    title: "Moda e beleza",
    body: "Achados de roupas, acessórios e beleza com desconto real pra aproveitar.",
  },
  {
    title: "Ofertas relâmpago",
    body: "Promoções que acabam rápido — você recebe antes e pega as melhores.",
  },
  {
    title: "Links verificados",
    body: "Somente oportunidades de lojas confiáveis, pra comprar com segurança.",
  },
];

export const VIP_TERROSO_CARD_DEFAULTS: VipTerrosoCardRow[] = [
  {
    emoji: "📦",
    title: "Links de produtos todo dia",
    body: "Acesso aos links das melhores ofertas dos marketplaces",
  },
  {
    emoji: "💸",
    title: "Descontos de até 70%",
    body: "Economia real em produtos selecionados a dedo para você",
  },
  {
    emoji: "🎟️",
    title: "Cupons Secretos",
    body: "Acesso a cupons exclusivos que só a nossa comunidade tem",
  },
  {
    emoji: "🔥",
    title: "Os melhores produtos com os melhores preços",
    body: "Casa, beleza, eletrônicos e muito mais",
  },
];

export const AURORA_CARD_DEFAULTS: { name: string; city: string; quote: string; defaultAvatar: string }[] = [
  {
    name: "Mariana",
    city: "São Paulo",
    defaultAvatar: "/notifi/w3.jpg",
    quote:
      "Comprei um fone que tava mais de R$100 por menos da metade — o cupom apareceu no grupo antes de viralizar na loja. Valeu demais.",
  },
  {
    name: "Ricardo",
    city: "Belo Horizonte",
    defaultAvatar: "/notifi/08.jpg",
    quote:
      "Air fryer com desconto forte e ainda peguei cashback que só mostraram aqui. No fim do mês a economia foi real.",
  },
  {
    name: "Camila",
    city: "Rio de Janeiro",
    defaultAvatar: "/notifi/w10.jpg",
    quote:
      "Entrei por curiosidade e no mesmo dia fechei presente com quase 60% off. É objetivo, sem ficção — só oferta boa.",
  },
];

export const SIMPLE_FOUR_LINE_DEFAULTS: string[] = [
  "Ofertas relâmpago antes de qualquer um",
  "Cupons exclusivos com até 80% OFF",
  "Frete grátis nas melhores lojas",
  "Alertas de promoções por tempo limitado",
];

const SIMPLE_LINE_EXTRAS: string[] = [
  "Novidades curadas todos os dias",
  "Entrada gratuita — saia quando quiser",
  "Ofertas revisadas antes de publicar",
  "Grupo ativo com milhares de membros",
  "Links diretos às páginas oficiais",
  "Economia real no fechamento da compra",
  "Alertas rápidos de preço e estoque",
  "Cupom surpresa quando rola campanha",
];

export type PromoCardsDraft = {
  rosa: VipRosaCardRow[];
  terroso: VipTerrosoCardRow[];
  aurora: AuroraCardRow[];
  simpleFour: string[];
};

function clip(s: string, max: number): string {
  return String(s ?? "")
    .trim()
    .slice(0, max);
}

function clipEmoji(s: string): string {
  const t = String(s ?? "").trim();
  if (!t) return "";
  return [...t].slice(0, 8).join("");
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function rosaPadRow(i: number): VipRosaCardRow {
  const def = VIP_ROSA_CARD_DEFAULTS[Math.min(i, VIP_ROSA_CARD_DEFAULTS.length - 1)]!;
  return {
    title: def.title,
    body: def.body,
    iconKey: defaultRosaIconKeyForIndex(i),
    emoji: "",
  };
}

function terroPadRow(i: number): VipTerrosoCardRow {
  const def = VIP_TERROSO_CARD_DEFAULTS[Math.min(i, VIP_TERROSO_CARD_DEFAULTS.length - 1)]!;
  return { ...def };
}

function auroraPadRow(i: number): AuroraCardRow {
  const def = AURORA_CARD_DEFAULTS[Math.min(i, AURORA_CARD_DEFAULTS.length - 1)]!;
  return {
    name: def.name,
    city: def.city,
    quote: def.quote,
    avatar_path: null,
  };
}

function simplePadLine(i: number): string {
  if (i < SIMPLE_FOUR_LINE_DEFAULTS.length) return SIMPLE_FOUR_LINE_DEFAULTS[i]!;
  const j = i - SIMPLE_FOUR_LINE_DEFAULTS.length;
  return SIMPLE_LINE_EXTRAS[j % SIMPLE_LINE_EXTRAS.length]!;
}

export function createDefaultPromoCardsDraft(): PromoCardsDraft {
  return {
    rosa: VIP_ROSA_CARD_DEFAULTS.map((_, i) => rosaPadRow(i)),
    terroso: VIP_TERROSO_CARD_DEFAULTS.map((_, i) => terroPadRow(i)),
    aurora: AURORA_CARD_DEFAULTS.map((_, i) => auroraPadRow(i)),
    simpleFour: [...SIMPLE_FOUR_LINE_DEFAULTS],
  };
}

export function normalizeVipRosaCardsFromDb(raw: unknown): VipRosaCardRow[] {
  const base = VIP_ROSA_CARD_DEFAULTS.map((_, i) => rosaPadRow(i));
  if (!Array.isArray(raw) || raw.length === 0) return base;

  const len = Math.min(Math.max(raw.length, PROMO_ROSA_MIN), PROMO_ROSA_MAX);
  const out: VipRosaCardRow[] = [];
  for (let i = 0; i < len; i++) {
    const pad = rosaPadRow(i);
    const row = raw[i];
    if (!isObj(row)) {
      out.push(pad);
      continue;
    }
    const title = clip(String(row.title ?? ""), L.rosaTitle);
    const body = clip(String(row.body ?? ""), L.rosaBody);
    const iconKey = normalizeRosaIconKey(String(row.iconKey ?? pad.iconKey));
    const emoji = clipEmoji(String(row.emoji ?? ""));
    out.push({
      title: title || pad.title,
      body: body || pad.body,
      iconKey,
      emoji,
    });
  }
  return out;
}

export function normalizeVipTerrosoCardsFromDb(raw: unknown): VipTerrosoCardRow[] {
  const base = VIP_TERROSO_CARD_DEFAULTS.map((_, i) => terroPadRow(i));
  if (!Array.isArray(raw) || raw.length === 0) return base;

  const len = Math.min(Math.max(raw.length, PROMO_TERRO_MIN), PROMO_TERRO_MAX);
  const out: VipTerrosoCardRow[] = [];
  for (let i = 0; i < len; i++) {
    const pad = terroPadRow(i);
    const row = raw[i];
    if (!isObj(row)) {
      out.push(pad);
      continue;
    }
    const title = clip(String(row.title ?? ""), L.terroTitle);
    const body = clip(String(row.body ?? ""), L.terroBody);
    const emoji = clip(String(row.emoji ?? pad.emoji), L.terroEmoji) || pad.emoji;
    out.push({
      emoji,
      title: title || pad.title,
      body: body || pad.body,
    });
  }
  return out;
}

function normalizeAvatarPath(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.includes("..") || s.startsWith("/")) return null;
  return s.slice(0, 512);
}

export function normalizeAuroraCardsFromDb(raw: unknown): AuroraCardRow[] {
  const base = AURORA_CARD_DEFAULTS.map((_, i) => auroraPadRow(i));
  if (!Array.isArray(raw) || raw.length === 0) return base;

  const len = Math.min(Math.max(raw.length, PROMO_AURORA_MIN), PROMO_AURORA_MAX);
  const out: AuroraCardRow[] = [];
  for (let i = 0; i < len; i++) {
    const pad = auroraPadRow(i);
    const row = raw[i];
    if (!isObj(row)) {
      out.push(pad);
      continue;
    }
    const name = clip(String(row.name ?? ""), L.aurName);
    const city = clip(String(row.city ?? ""), L.aurCity);
    const quote = clip(String(row.quote ?? ""), L.aurQuote);
    const avatar_path = normalizeAvatarPath(row.avatar_path ?? row.avatarPath);
    out.push({
      name: name || pad.name,
      city: city || pad.city,
      quote: quote || pad.quote,
      avatar_path: avatar_path ?? pad.avatar_path,
    });
  }
  return out;
}

export function normalizeSimpleFourLinesFromDb(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...SIMPLE_FOUR_LINE_DEFAULTS];

  const len = Math.min(Math.max(raw.length, PROMO_SIMPLE_MIN), PROMO_SIMPLE_MAX);
  const out: string[] = [];
  for (let i = 0; i < len; i++) {
    const pad = simplePadLine(i);
    const row = raw[i];
    if (typeof row === "string") {
      const t = clip(row, L.line);
      out.push(t || pad);
      continue;
    }
    if (isObj(row)) {
      const t = clip(String(row.line ?? row.text ?? ""), L.line);
      out.push(t || pad);
      continue;
    }
    out.push(pad);
  }
  return out;
}

export function mergePromoCardsDraftFromDb(
  pageTemplate: PageTemplate | null | undefined,
  raw: unknown,
): PromoCardsDraft {
  const tpl = pageTemplate ?? "classic";
  const draft = createDefaultPromoCardsDraft();
  if (!Array.isArray(raw)) return draft;

  if (tpl === "vip_rosa") draft.rosa = normalizeVipRosaCardsFromDb(raw);
  else if (tpl === "vip_terroso") draft.terroso = normalizeVipTerrosoCardsFromDb(raw);
  else if (tpl === "aurora_ledger") draft.aurora = normalizeAuroraCardsFromDb(raw);
  else if (tpl === "vinho_rose" || tpl === "the_new_chance") draft.simpleFour = normalizeSimpleFourLinesFromDb(raw);

  return draft;
}

export function promoSectionCardsToDbValue(pageTemplate: PageTemplate, draft: PromoCardsDraft): unknown {
  switch (pageTemplate) {
    case "vip_rosa":
      return draft.rosa.map((r) => ({
        title: clip(r.title, L.rosaTitle),
        body: clip(r.body, L.rosaBody),
        iconKey: normalizeRosaIconKey(r.iconKey),
        emoji: clipEmoji(r.emoji),
      }));
    case "vip_terroso":
      return draft.terroso.map((r) => ({
        emoji: clip(r.emoji, L.terroEmoji),
        title: clip(r.title, L.terroTitle),
        body: clip(r.body, L.terroBody),
      }));
    case "aurora_ledger":
      return draft.aurora.map((r) => ({
        name: clip(r.name, L.aurName),
        city: clip(r.city, L.aurCity),
        quote: clip(r.quote, L.aurQuote),
        avatar_path: normalizeAvatarPath(r.avatar_path),
      }));
    case "vinho_rose":
    case "the_new_chance":
      return draft.simpleFour.map((line) => clip(line, L.line));
    default:
      return null;
  }
}

export function resolvePromoCardsForPublicPage(pageTemplate: PageTemplate, raw: unknown): unknown {
  switch (pageTemplate) {
    case "vip_rosa":
      return normalizeVipRosaCardsFromDb(raw);
    case "vip_terroso":
      return normalizeVipTerrosoCardsFromDb(raw);
    case "aurora_ledger":
      return normalizeAuroraCardsFromDb(raw);
    case "vinho_rose":
    case "the_new_chance":
      return normalizeSimpleFourLinesFromDb(raw);
    default:
      return null;
  }
}

/** Novo card VIP Rosa (último índice + 1 para ícone por defeito). */
export function appendEmptyRosaCard(draft: PromoCardsDraft): PromoCardsDraft {
  if (draft.rosa.length >= PROMO_ROSA_MAX) return draft;
  const i = draft.rosa.length;
  return { ...draft, rosa: [...draft.rosa, rosaPadRow(i)] };
}

export function removeLastRosaCard(draft: PromoCardsDraft): PromoCardsDraft {
  if (draft.rosa.length <= PROMO_ROSA_MIN) return draft;
  return { ...draft, rosa: draft.rosa.slice(0, -1) };
}

export function appendEmptyTerrosoCard(draft: PromoCardsDraft): PromoCardsDraft {
  if (draft.terroso.length >= PROMO_TERRO_MAX) return draft;
  const i = draft.terroso.length;
  return { ...draft, terroso: [...draft.terroso, terroPadRow(i)] };
}

export function removeLastTerrosoCard(draft: PromoCardsDraft): PromoCardsDraft {
  if (draft.terroso.length <= PROMO_TERRO_MIN) return draft;
  return { ...draft, terroso: draft.terroso.slice(0, -1) };
}

export function appendEmptyAuroraCard(draft: PromoCardsDraft): PromoCardsDraft {
  if (draft.aurora.length >= PROMO_AURORA_MAX) return draft;
  const i = draft.aurora.length;
  return { ...draft, aurora: [...draft.aurora, auroraPadRow(i)] };
}

export function removeLastAuroraCard(draft: PromoCardsDraft): PromoCardsDraft {
  if (draft.aurora.length <= PROMO_AURORA_MIN) return draft;
  return { ...draft, aurora: draft.aurora.slice(0, -1) };
}

export function appendSimpleLine(draft: PromoCardsDraft): PromoCardsDraft {
  if (draft.simpleFour.length >= PROMO_SIMPLE_MAX) return draft;
  const i = draft.simpleFour.length;
  return { ...draft, simpleFour: [...draft.simpleFour, simplePadLine(i)] };
}

export function removeLastSimpleLine(draft: PromoCardsDraft): PromoCardsDraft {
  if (draft.simpleFour.length <= PROMO_SIMPLE_MIN) return draft;
  return { ...draft, simpleFour: draft.simpleFour.slice(0, -1) };
}

export function removeRosaCardAt(draft: PromoCardsDraft, index: number): PromoCardsDraft {
  if (draft.rosa.length <= PROMO_ROSA_MIN) return draft;
  return { ...draft, rosa: draft.rosa.filter((_, j) => j !== index) };
}

export function removeTerrosoCardAt(draft: PromoCardsDraft, index: number): PromoCardsDraft {
  if (draft.terroso.length <= PROMO_TERRO_MIN) return draft;
  return { ...draft, terroso: draft.terroso.filter((_, j) => j !== index) };
}

export function removeAuroraCardAt(draft: PromoCardsDraft, index: number): PromoCardsDraft {
  if (draft.aurora.length <= PROMO_AURORA_MIN) return draft;
  return { ...draft, aurora: draft.aurora.filter((_, j) => j !== index) };
}

export function removeSimpleLineAt(draft: PromoCardsDraft, index: number): PromoCardsDraft {
  if (draft.simpleFour.length <= PROMO_SIMPLE_MIN) return draft;
  return { ...draft, simpleFour: draft.simpleFour.filter((_, j) => j !== index) };
}
