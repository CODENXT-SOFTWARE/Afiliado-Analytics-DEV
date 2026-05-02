/**
 * Catálogo de cupons trial (documentação + prefill no front).
 *
 * A validação real é feita na tabela `trial_coupons` no Supabase.
 * Ao adicionar cupom:
 * 1. INSERT em nova migration SQL (ou Editor) com o mesmo `code` em MAIÚSCULAS.
 * 2. Opcional: inclua a linha abaixo para lembrar o time / alinhar prefill.
 */
export type TrialCouponCatalogEntry = {
  /** Mesmo valor que `trial_coupons.code` (maiúsculas). */
  cupom: string;
  /** Dias de acesso após o cadastro (`trial_coupons.duration_days`). */
  days: number;
  ativo: boolean;
  /** Limite de usos (`trial_coupons.max_uses`). */
  quantidade: number;
};

export const TRIAL_COUPONS_CATALOG: TrialCouponCatalogEntry[] = [
  { cupom: "3DAYSFREE", days: 3, ativo: true, quantidade: 99999 },
  { cupom: "7DAYSFREE", days: 7, ativo: true, quantidade: 99999 },
  { cupom: "30DAYSFREE", days: 30, ativo: true, quantidade: 99999 },
  { cupom: "1DAYFREE", days: 1, ativo: true, quantidade: 99999 },
  { cupom: "BRENDA3DAYS", days: 3, ativo: true, quantidade: 99999 },
];

/** Cupom exibido por padrão no modal de cadastro gratuito. */
export const DEFAULT_TRIAL_COUPON_CODE = "3DAYSFREE";
