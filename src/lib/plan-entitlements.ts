/**
 * Limites e flags por tier de plano. Fonte da verdade pra TODOS os gates.
 *
 * Tiers ativos (top→bottom em features/preço):
 *   - pro    — plano completo (R$ 197,90/mês • R$ 527,90/trim)
 *   - padrao — intermediário (R$ 127,90/mês • R$ 297,90/trim)
 *   - inicial — entrada (R$ 47,90/mês • R$ 127,90/trim)
 *   - trial  — onboarding por cupom (≡ inicial em features, acesso por tempo limitado)
 *   - legacy — clientes antigos do "padrao" original (≡ inicial + infoprodutor herdado)
 *   - staff  — interno (≥ pro)
 *
 * SPEC OFICIAL (mantenha sincronizado com /pricing):
 *
 *   TRIAL (duração definida pelo cupom — 3 dias é o default atual) ≡ INICIAL:
 *     ✓ Análise de comissões / cliques
 *     ✓ Redirecionador de links
 *     ✓ Gerador de links Shopee
 *     ✓ Site de captura: 1
 *     ✓ Automação de Grupos: 1 grupo, 1 instância
 *     ✓ Minha lista de oferta
 *     ✓ Automação Telegram: ilimitado
 *     ✗ apenas Shopee — NÃO acessa Amazon, Mercado Livre, Tendências Shopee,
 *       Análise de ofertas relâmpago, ATI, GPL, Espelhamento, Infoprodutor,
 *       Criar Campanha Meta, Gerador Criativos, Gerador Especialistas
 *
 *   PADRÃO:
 *     ✓ Tudo do Inicial +
 *     ✓ Tráfego Inteligente (ATI)
 *     ✓ Custo Real de Leads do WhatsApp (GPL)
 *     ✓ Criar Campanha no Meta
 *     ✓ Automação de Grupos: ilimitado, 2 instâncias, disparos ilimitados
 *     ✓ Espelhamento de Grupos: 10 ativos
 *     ✓ Site de captura: 5
 *     ✓ Infoprodutor (Mercado Pago + checkout dinâmico)
 *     ✓ Shopee + Amazon + Mercado Livre
 *     ✓ Tendências Shopee + Análise de ofertas relâmpago
 *     ✗ Gerador de Criativos (vídeo)
 *     ✗ Gerador de Especialistas
 *
 *   PRO:
 *     ✓ Tudo do Padrão +
 *     ✓ Gerador de Criativos: 2 vídeos/dia
 *     ✓ Gerador de Especialistas (consome Afiliado Coins; 100 coins de bônus mensal)
 *     ✓ Espelhamento de Grupos: ilimitado
 *     ✓ Instâncias conectadas: 5
 */

export type PlanTier = "legacy" | "inicial" | "padrao" | "pro" | "staff" | "trial";

/** Sentinela de "ilimitado" para limites numéricos (Padrão/Pro: grupos/disparos sem teto prático). */
export const UNLIMITED = 999_999;

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
  /** Limite diário de «Gerar copy com IA» (Grok) antes de cobrar coins. */
  videoEditorCopyPerDay: number;
  espelhamentogrupos: boolean;
  /** Teto de espelhamentos ativos. null = ilimitado (Pro). 0 quando feature desligada. */
  espelhamentogruposMax: number | null;
  especialistagenerate: boolean;
  /** Infoprodutor: catálogo Mercado Pago + checkout dinâmico (frete). Padrão+, e legacy. */
  infoprodutor: boolean;
  /** Tendências Shopee (curadoria de produtos em alta). Padrão+. */
  tendenciasShopee: boolean;
  /**
   * Análise de ofertas relâmpago (aba `flash` em Tendências Shopee).
   * Padrão+. Hoje espelha `tendenciasShopee`, mas mantemos a flag separada
   * porque o spec lista como item próprio na grade de preços.
   */
  analiseOfertasRelampago: boolean;
  /** Acesso ao marketplace Mercado Livre (gerador, listas, automação). Padrão+. */
  mercadoLivre: boolean;
  /**
   * Acesso ao marketplace Amazon (gerador, listas, automação).
   * Spec: Padrão+ libera. Inicial/Trial só Shopee.
   * Mantemos a flag separada de `mercadoLivre` pra dar flexibilidade futura
   * (ex.: criar bundle “somente Amazon” ou habilitar Amazon antes de ML).
   */
  amazon: boolean;
};



/** Inicial (R$ 47,90/mês • R$ 127,90/trim) — entrada. Apenas Shopee, 1 grupo, 1 instância. */
const INICIAL_LIMITS = {
  analiseComissoes: true,
  analiseCliques: true,
  meusLinks: true,
  captureLinks: 1,
  gpl: {
    enabled: false,
    showSummaryCards: false,
    showGroupsCampaignsInstance: false,
  },
  geradorLinksShopee: true,
  gruposVenda: {
    maxActiveCampaigns: 1,
    maxLists: null,
    maxGroupsTotal: 1,
  },
  evolutionInstances: 1,
  ati: false,
  criarCampanhaMeta: false,
  geradorCriativos: false,
  videoExportsPerDay: null,
  voicegenerate: 0,
  videoEditorCopyPerDay: 0,
  espelhamentogrupos: false,
  espelhamentogruposMax: 0,
  especialistagenerate: false,
  infoprodutor: false,
  tendenciasShopee: false,
  analiseOfertasRelampago: false,
  mercadoLivre: false,
  amazon: false,
} as const satisfies PlanEntitlements;

/**
 * Padrão (R$ 127,90/mês • R$ 297,90/trim) — intermediário.
 * Tudo do Inicial + ATI + GPL + Criar Campanha Meta + grupos ilimitado +
 * espelhamento 10 + 5 sites + Infoprodutor + ML/Amazon + Tendências/Relâmpago.
 */
const PADRAO_LIMITS = {
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
    maxActiveCampaigns: UNLIMITED,
    maxLists: null,
    maxGroupsTotal: UNLIMITED,
  },
  evolutionInstances: 2,
  ati: true,
  criarCampanhaMeta: true,
  geradorCriativos: false,
  videoExportsPerDay: null,
  voicegenerate: 0,
  videoEditorCopyPerDay: 0,
  espelhamentogrupos: true,
  espelhamentogruposMax: 10,
  especialistagenerate: false,
  infoprodutor: true,
  tendenciasShopee: true,
  analiseOfertasRelampago: true,
  mercadoLivre: true,
  amazon: true,
} as const satisfies PlanEntitlements;

/** Trial por cupom — mesmas features do Inicial, acesso limitado por `trial_access_until`. */
const TRIAL_LIMITS = {
  analiseComissoes: true,
  analiseCliques: true,
  meusLinks: true,
  captureLinks: 1,
  gpl: {
    enabled: false,
    showSummaryCards: false,
    showGroupsCampaignsInstance: false,
  },
  geradorLinksShopee: true,
  gruposVenda: {
    maxActiveCampaigns: 1,
    maxLists: null,
    maxGroupsTotal: 1,
  },
  evolutionInstances: 1,
  ati: false,
  criarCampanhaMeta: false,
  geradorCriativos: false,
  videoExportsPerDay: null,
  voicegenerate: 0,
  videoEditorCopyPerDay: 0,
  espelhamentogrupos: false,
  espelhamentogruposMax: 0,
  especialistagenerate: false,
  infoprodutor: false,
  tendenciasShopee: false,
  analiseOfertasRelampago: false,
  mercadoLivre: false,
  amazon: false,
} as const satisfies PlanEntitlements;

/**
 * Pro (R$ 197,90/mês • R$ 527,90/trim) — completo.
 * Tudo do Padrão + Gerador de Criativos (2 vídeos/dia) + Especialistas
 * + espelhamento ilimitado + 5 instâncias.
 */
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
    maxActiveCampaigns: UNLIMITED,
    maxLists: null,
    maxGroupsTotal: UNLIMITED,
  },
  evolutionInstances: 5,
  ati: true,
  criarCampanhaMeta: true,
  geradorCriativos: true,
  videoExportsPerDay: 2,
  voicegenerate: 2,
  videoEditorCopyPerDay: 2,
  espelhamentogrupos: true,
  espelhamentogruposMax: null,
  especialistagenerate: true,
  infoprodutor: true,
  tendenciasShopee: true,
  analiseOfertasRelampago: true,
  mercadoLivre: true,
  amazon: true,
} as const satisfies PlanEntitlements;

/** Legacy — clientes antigos do "padrao" original. Iguala Inicial em limites + mantém infoprodutor que já tinham. */
const LEGACY_LIMITS = {
  ...INICIAL_LIMITS,
  infoprodutor: true,
} as const satisfies PlanEntitlements;

/** Staff — uso interno; >= Pro. */
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
    maxActiveCampaigns: UNLIMITED,
    maxLists: null,
    maxGroupsTotal: UNLIMITED,
  },
  evolutionInstances: 10,
  ati: true,
  criarCampanhaMeta: true,
  geradorCriativos: true,
  videoExportsPerDay: 2,
  voicegenerate: 2,
  videoEditorCopyPerDay: 2,
  espelhamentogrupos: true,
  espelhamentogruposMax: null,
  especialistagenerate: true,
  infoprodutor: true,
  tendenciasShopee: true,
  analiseOfertasRelampago: true,
  mercadoLivre: true,
  amazon: true,
} as const satisfies PlanEntitlements;

/** Cada tier recebe seu próprio objeto (sem aliasing) para mutações em runtime nunca vazarem. */
export const LIMITS: Record<PlanTier, PlanEntitlements> = {
  legacy: { ...LEGACY_LIMITS, gpl: { ...LEGACY_LIMITS.gpl }, gruposVenda: { ...LEGACY_LIMITS.gruposVenda } },
  inicial: { ...INICIAL_LIMITS, gpl: { ...INICIAL_LIMITS.gpl }, gruposVenda: { ...INICIAL_LIMITS.gruposVenda } },
  padrao: { ...PADRAO_LIMITS, gpl: { ...PADRAO_LIMITS.gpl }, gruposVenda: { ...PADRAO_LIMITS.gruposVenda } },
  pro: { ...PRO_LIMITS, gpl: { ...PRO_LIMITS.gpl }, gruposVenda: { ...PRO_LIMITS.gruposVenda } },
  staff: { ...STAFF_LIMITS, gpl: { ...STAFF_LIMITS.gpl }, gruposVenda: { ...STAFF_LIMITS.gruposVenda } },
  trial: { ...TRIAL_LIMITS, gpl: { ...TRIAL_LIMITS.gpl }, gruposVenda: { ...TRIAL_LIMITS.gruposVenda } },
};

export function getEntitlementsForTier(tier: PlanTier | string | null | undefined): PlanEntitlements {
  if (tier === "pro") return LIMITS.pro;
  if (tier === "staff") return LIMITS.staff;
  if (tier === "trial") return LIMITS.trial;
  if (tier === "padrao") return LIMITS.padrao;
  if (tier === "legacy") return LIMITS.legacy;
  if (tier === "inicial") return LIMITS.inicial;
  // fallback seguro
  return LIMITS.inicial;
}

/** Tone usado em `Pricing` / cards de assinatura para marcar o plano atual como bloqueado. */
export type SubscriptionPlanTone = "inicial" | "padrao" | "pro";

export function subscriptionToneForPlanTier(tier: PlanTier): SubscriptionPlanTone {
  if (tier === "pro" || tier === "staff") return "pro";
  if (tier === "padrao") return "padrao";
  return "inicial";
}
