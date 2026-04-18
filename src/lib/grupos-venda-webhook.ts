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
    `✨ ${nomeProduto}\n` +
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

/**
 * Infoprodutor: produto cadastrado pelo próprio utilizador (sem API de afiliados).
 * Pode ter descrição livre e preço opcional; não há "risco/desconto".
 */
export type InfoprodutorWebhookInput = {
  instanceName: string;
  hash: string;
  groupIds: string[];
  nomeProduto: string;
  descricaoLivre: string;
  imageUrl: string;
  link: string;
  preco: number | null;
  /** Preço “de” (riscado no texto; opcional). */
  precoAntigo?: number | null;
};

export function buildInfoprodutorDescription(input: InfoprodutorWebhookInput): string {
  const { nomeProduto, descricaoLivre, preco, precoAntigo, link } = input;
  const parts: string[] = [];
  parts.push(`✨ ${nomeProduto}`);
  if (descricaoLivre && descricaoLivre.trim()) {
    parts.push("");
    parts.push(descricaoLivre.trim());
  }
  const old = precoAntigo != null && precoAntigo > 0 ? precoAntigo : null;
  const cur = preco != null && preco > 0 ? preco : null;
  if (old != null || cur != null) {
    parts.push("");
    let line = "💰 ";
    if (old != null) {
      line += `De: ~${formatBRL(old)}~ 📉 `;
    }
    if (cur != null) {
      line += `Por apenas: *${formatBRL(cur)}*`;
    } else if (old != null) {
      line = line.trimEnd();
    }
    parts.push(line);
  }
  parts.push("");
  parts.push("🛒 GARANTA O SEU - CLIQUE NO LINK 👇");
  parts.push(link);
  return parts.join("\n");
}

export function buildInfoprodutorWebhookPayload(input: InfoprodutorWebhookInput) {
  const { preco, precoAntigo, link, imageUrl, instanceName, hash, groupIds } = input;
  const descricao = buildInfoprodutorDescription(input);
  const old = precoAntigo != null && precoAntigo > 0 ? precoAntigo : null;
  return {
    instanceName,
    hash,
    groupIds,
    imagem: imageUrl ?? "",
    descricao,
    valor: preco ?? 0,
    linkAfiliado: link,
    desconto: null as number | null,
    precoRiscado: old,
    precoPor: preco != null && preco > 0 ? preco : null,
  };
}
