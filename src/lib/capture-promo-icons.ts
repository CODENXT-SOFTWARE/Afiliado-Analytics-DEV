/** Chaves de ícones Lucide permitidos nos cards VIP Rosa (só strings — o template faz o mapa). */
export const VIP_ROSA_ICON_KEYS = [
  "Ticket",
  "Home",
  "ShoppingBag",
  "Zap",
  "CheckCircle",
  "Gift",
  "Star",
  "Heart",
  "Flame",
  "Sparkles",
  "Tag",
  "Percent",
  "Truck",
  "ShieldCheck",
  "Megaphone",
  "Bell",
  "Wallet",
  "Smartphone",
] as const;

export type VipRosaIconKey = (typeof VIP_ROSA_ICON_KEYS)[number];

/** Lista `{ value, label }` para pickers (MetaSearchablePicker, etc.). */
export const vipRosaIconPickerOptions: { value: VipRosaIconKey; label: string }[] = VIP_ROSA_ICON_KEYS.map(
  (k) => ({ value: k, label: k }),
);

const ALLOWED = new Set<string>(VIP_ROSA_ICON_KEYS);

/** Ícone por defeito para cada posição (5 primeiros alinhados ao template original). */
export const VIP_ROSA_ICON_KEYS_DEFAULT: VipRosaIconKey[] = [
  "Ticket",
  "Home",
  "ShoppingBag",
  "Zap",
  "CheckCircle",
];

export function normalizeRosaIconKey(raw: string | undefined | null): VipRosaIconKey {
  const k = String(raw ?? "").trim();
  if (ALLOWED.has(k)) return k as VipRosaIconKey;
  return "Ticket";
}

export function defaultRosaIconKeyForIndex(i: number): VipRosaIconKey {
  return VIP_ROSA_ICON_KEYS_DEFAULT[Math.min(i, VIP_ROSA_ICON_KEYS_DEFAULT.length - 1)]!;
}
