/**
 * Formato único de descrição + payload do webhook de Grupos de Venda (lista fixa).
 */

/** Webhook n8n padrão: keywords, lista só Shopee ou só ML. */
export const GRUPOS_VENDA_WEBHOOK_DEFAULT = "https://n8n.iacodenxt.online/webhook/achadinhoN1";

/**
 * Lista Shopee + lista ML na mesma automação — mesmo payload `buildListaOfferWebhookPayload`, workflow separado.
 * Override opcional: `N8N_WEBHOOK_GRUPOS_VENDA_CROSSOVER_ML`.
 */
const envCrossoverMl = process.env.N8N_WEBHOOK_GRUPOS_VENDA_CROSSOVER_ML?.trim();
export const GRUPOS_VENDA_WEBHOOK_CROSSOVER_ML =
  envCrossoverMl || "https://n8n.iacodenxt.online/webhook/Mercadolivre-Achadinhos";

export function resolveGruposVendaListaWebhookUrl(crossoverShopeeMl: boolean): string {
  return crossoverShopeeMl ? GRUPOS_VENDA_WEBHOOK_CROSSOVER_ML : GRUPOS_VENDA_WEBHOOK_DEFAULT;
}

export type ListaOfferWebhookInput = {
  instanceName: string;
  hash: string;
  groupIds: string[];
  nomeProduto: string;
  imageUrl: string;
  precoPor: number;
  precoRiscado: number;
  discountRate: number;
  linkAfiliado: string;
};

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(n);

export function buildListaOfferDescription(input: ListaOfferWebhookInput): string {
  const { nomeProduto, precoPor, precoRiscado, discountRate, linkAfiliado } = input;
  const rate = discountRate;
  return (
    `✨ ${nomeProduto}\n\n` +
    `💰 APROVEITE:${rate > 0 ? ` _${Math.round(rate)}% de DESCONTO!!!!_` : ""} \n🔴 De: ~${formatBRL(precoRiscado)}~ \n🔥 Por: *${formatBRL(precoPor)}* 😱\n` +
    `🏷️ PROMOÇÃO - CLIQUE NO LINK 👇\n` +
    linkAfiliado
  );
}

export function buildListaOfferWebhookPayload(input: ListaOfferWebhookInput) {
  const { precoPor, precoRiscado, discountRate, linkAfiliado, imageUrl, instanceName, hash, groupIds } = input;
  const descricao = buildListaOfferDescription(input);
  const rate = discountRate;
  return {
    instanceName,
    hash,
    groupIds,
    imagem: imageUrl ?? "",
    descricao,
    valor: precoPor,
    linkAfiliado,
    desconto: rate > 0 ? Math.round(rate) : null,
    precoRiscado: precoRiscado > 0 ? precoRiscado : null,
    precoPor: precoPor > 0 ? precoPor : null,
  };
}
