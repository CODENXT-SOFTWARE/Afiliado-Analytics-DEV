/**
 * Advanced Traffic Intelligence (ATI) – tipos para Meta + Shopee
 */

export type MetricLevel = "excellent" | "good" | "bad";

export type CreativeStatus = "excellent" | "good" | "bad" | "pending";

export type ScaleStatus = "excellent" | "good" | "bad" | "maturing";

/** Uma métrica com valor e nível (cor) */
export interface MetricWithLevel<T = number> {
  value: T;
  level: MetricLevel;
}

/** Regras de threshold (em reais ou percentual conforme a métrica) */
export const ATI_THRESHOLDS = {
  /** CPC Meta (R$) */
  cpcMeta: { excellent: 0.09, goodMax: 0.18, badMin: 0.2 },
  /** Discrepância de cliques (%) */
  clickDiscrepancy: { excellent: 15, goodMax: 30, badMin: 35 },
  /** CPA (R$) */
  cpa: { excellent: 1.5, goodMax: 3.8, badMin: 4 },
  /** ROAS (ratio) */
  roas: { excellent: 3, goodMin: 1.5, goodMax: 2.9, badMax: 1.3 },
  /** Para status "Criativo Excelente": ROAS >= 2.5 */
  creativeExcellentRoas: 2.5,
  /** Para status "Criativo Ruim": ROAS < 1.3, Dif > 40%, CPC > 0.25 */
  creativeBadRoas: 1.3,
  creativeBadClickDiff: 40,
  creativeBadCpc: 0.25,
  /** Exceção: ROAS > 4.0 pode ser Excelente mesmo com CPC amarelo */
  creativeExceptionRoas: 4,
  /** Escala: aguardar 3 dias */
  scaleMaturingDays: 3,
  /** Escala Ruim: ROAS < 1.4 ou lucro negativo 3 dias */
  scaleBadRoas: 1.4,
  /** Escala Excelente: ROAS >= 2.5 */
  scaleExcellentRoas: 2.5,
} as const;

/** Dados agregados por criativo (ad) para exibição */
export interface ATICreativeRow {
  /** IDs Meta */
  adId: string;
  adName: string;
  adSetId: string;
  adSetName: string;
  campaignId: string;
  campaignName: string;
  /** Conta de anúncios (para criar conjunto/anúncio pelo ATI) */
  adAccountId?: string;
  /** Sub ID Shopee (Sub1 do gerador) configurado no ATI para este anúncio */
  subId: string | null;
  shopeeSubId?: string | null;
  /** Sub ID InfoP (cruzamento com produtos Stripe) */
  infopSubId?: string | null;
  /** Métricas Meta */
  cost: number;
  clicksMeta: number;
  ctrMeta: number;
  cpcMeta: number;
  /** Métricas Shopee (cruzadas) */
  clicksShopee: number;
  cpcShopee: number;
  orders: number;
  /** Pedidos com Tipo de atribuição = "Direta" (mesmo lojista do link clicado) */
  directOrders: number;
  revenue: number;
  commission: number;
  /** Derivadas */
  cpa: number;
  roas: number;
  epc: number;
  /** Discrepância de cliques (%). (clicksMeta - clicksShopee) / clicksMeta * 100. Com proxy Shopee=Meta, tende a 0. */
  clickDiscrepancyPct: number;
  /** Níveis por métrica (para bolinhas) */
  levelCpcMeta: MetricLevel;
  levelClickDiscrepancy: MetricLevel;
  levelCpa: MetricLevel;
  levelRoas: MetricLevel;
  /** Status principal do card (excelente / bom / ruim) */
  status: CreativeStatus;
  /** Diagnóstico de apoio (texto) */
  diagnosis: string;
  /** Se pode mostrar botão "Adicionar em Criativo Validado" */
  canValidate: boolean;
}

/** Criativo que o usuário marcou como "validado" para escala */
export interface ATIValidatedCreative {
  id: string;
  userId: string;
  adId: string;
  adName: string;
  campaignId: string;
  campaignName: string;
  scaledAt: string; // ISO
}

/** Resposta da API de dados ATI */
export interface ATIDataResponse {
  creatives: ATICreativeRow[];
  validated: (ATIValidatedCreative & { scaleStatus?: ScaleStatus; scaleDiagnosis?: string })[];
  dateStart: string;
  dateEnd: string;
}
