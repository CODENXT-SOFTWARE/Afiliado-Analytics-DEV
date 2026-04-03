/**
 * Limites e flags por tier de plano.
 * `legacy` = mesmo comportamento que `padrao` (usuários antigos não ganham “tudo ilimitado”).
 */

export type PlanTier = "legacy" | "padrao" | "pro" | "staff";

export type GruposVendaLimits = {
  /** Campanhas ativas no máximo */
  maxActiveCampaigns: number;
  /** Máximo de listas de grupos (null = sem teto além do total de grupos) */
  maxLists: number | null;
  /** Teto total de grupos somando todas as listas */
  maxGroupsTotal: number;
};

export type GplUiLimits = {
  /** Calculadora GPL acessível */
  enabled: boolean;
  /** Cards de resumo (summary) visíveis */
  showSummaryCards: boolean;
  /** Bloco grupos/campanhas/instância visível */
  showGroupsCampaignsInstance: boolean;
};

export type PlanEntitlements = {
  analiseComissoes: boolean;
  analiseCliques: boolean;
  meusLinks: boolean;
  /**
   * Máximo de sites de captura gravados em `capture_sites` para o usuário.
   * Valor > 1 (ex.: pro/staff) exige no Postgres **sem** UNIQUE só em `userid`;
   * ver migration `20250325_capture_sites_multiple_per_user.sql`.
   */
  captureLinks: number;
  gpl: GplUiLimits;
  geradorLinksShopee: boolean;
  gruposVenda: GruposVendaLimits;
  /** Instâncias Evolution / WhatsApp */
  evolutionInstances: number;
  ati: boolean;
  criarCampanhaMeta: boolean;
  geradorCriativos: boolean;
  /** null = sem limite diário (feature desligada ou ilimitado) */
  videoExportsPerDay: number | null;
  /** Limite diário de gerações "voz + legendas" (ElevenLabs with-timestamps). */
  voicegenerate: number | null;
  espelhamentogrupos: boolean;
  especialistagenerate: boolean;
};



const PADRAO_LIMITS = {
  analiseComissoes: true,
  analiseCliques: true,
  meusLinks: true,
  captureLinks: 1,
  gpl: {
    enabled: true,
    showSummaryCards: false,
    showGroupsCampaignsInstance: false,
  },
  geradorLinksShopee: true,
  gruposVenda: {
    maxActiveCampaigns: 1,
    maxLists: 1,
    maxGroupsTotal: 1,
  },
  evolutionInstances: 1,
  ati: false,
  criarCampanhaMeta: false,
  geradorCriativos: false,
  videoExportsPerDay: null,
  voicegenerate: 0,
  espelhamentogrupos: false,
  especialistagenerate: false,
} as const satisfies PlanEntitlements;

const PRO_LIMITS = {
  analiseComissoes: true,
  analiseCliques: true,
  meusLinks: true,
  captureLinks: 5,
  gpl: {
    enabled: true,
    showSummaryCards: true,
    showGroupsCampaignsInstance: true,
  },
  geradorLinksShopee: true,
  gruposVenda: {
    maxActiveCampaigns: 10,
    maxLists: null,
    maxGroupsTotal: 10,
  },
  evolutionInstances: 2,
  ati: true,
  criarCampanhaMeta: true,
  geradorCriativos: true,
  videoExportsPerDay: 2,
  voicegenerate: 2,
  espelhamentogrupos: true,
  especialistagenerate: true,
} as const satisfies PlanEntitlements;



const STAFF_LIMITS = {
  analiseComissoes: true,
  analiseCliques: true,
  meusLinks: true,
  captureLinks: 5,
  gpl: {
    enabled: true,
    showSummaryCards: true,
    showGroupsCampaignsInstance: true,
  },
  geradorLinksShopee: true,
  gruposVenda: {
    maxActiveCampaigns: 20,
    maxLists: null,
    maxGroupsTotal: 20,
  },
  evolutionInstances: 10,
  ati: true,
  criarCampanhaMeta: true,
  geradorCriativos: true,
  videoExportsPerDay: 10,
  voicegenerate: 10,
  espelhamentogrupos: true,
  especialistagenerate: true,
} as const satisfies PlanEntitlements;

/** Mesma referência para legacy e padrao — alterar um não altera o outro em runtime se você clonar; aqui são iguais por definição. */
export const LIMITS: Record<PlanTier, PlanEntitlements> = {
  legacy: { ...PADRAO_LIMITS, gpl: { ...PADRAO_LIMITS.gpl }, gruposVenda: { ...PADRAO_LIMITS.gruposVenda } },
  padrao: { ...PADRAO_LIMITS, gpl: { ...PADRAO_LIMITS.gpl }, gruposVenda: { ...PADRAO_LIMITS.gruposVenda } },
  pro: { ...PRO_LIMITS, gpl: { ...PRO_LIMITS.gpl }, gruposVenda: { ...PRO_LIMITS.gruposVenda } },
  staff: { ...STAFF_LIMITS, gpl: { ...STAFF_LIMITS.gpl }, gruposVenda: { ...STAFF_LIMITS.gruposVenda } },
};

export function getEntitlementsForTier(tier: PlanTier | string | null | undefined): PlanEntitlements {
  if (tier === "pro") return LIMITS.pro;
  if (tier === "staff") return LIMITS.staff;
  if (tier === "padrao" || tier === "legacy") return LIMITS.padrao;
  // fallback seguro até existir plan_tier no profile
  return LIMITS.legacy;
}
