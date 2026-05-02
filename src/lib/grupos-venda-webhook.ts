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
  /**
   * Amazon: cupom em percentual (ex.: 14 → "Cupom de 14% OFF"). Opcional —
   * Shopee/ML não usam essa info hoje, mas o campo é tolerado e ignorado
   * quando ausente. Aparece na descrição e como `couponPercent` no JSON.
   */
  couponPercent?: number | null;
  /**
   * Amazon: cupom em valor fixo R$ (ex.: 5.00 → "Cupom de R$ 5,00 OFF").
   * Mutuamente exclusivo com `couponPercent`; só um aparece na descrição.
   */
  couponAmount?: number | null;
  /**
   * Amazon: desconto exclusivo Prime em % (ex.: 30 → "Prime: 30% OFF").
   * Linha separada na descrição abaixo do cupom.
   */
  primeDiscountPercent?: number | null;
  /** ML: desconto exclusivo Pix em % (ex.: 4 → "no Pix 4% OFF"). */
  pixDiscountPercent?: number | null;
  /** ML: produto entrega via FULL (logística ML — chega rápido). */
  isFull?: boolean | null;
  /** ML/Shopee: frete grátis disponível. */
  freeShipping?: boolean | null;
  /** ML: quantidade de parcelas sem juros (ex.: 4). */
  installmentsCount?: number | null;
  /** ML: valor de cada parcela em R$. */
  installmentAmount?: number | null;
  /** ML: true se as parcelas são sem juros. */
  installmentsFreeInterest?: boolean | null;
};

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(n);

export function buildListaOfferDescription(input: ListaOfferWebhookInput): string {
  const {
    nomeProduto,
    precoPor,
    precoRiscado,
    discountRate,
    linkAfiliado,
    couponPercent,
    couponAmount,
    primeDiscountPercent,
    pixDiscountPercent,
    isFull,
    freeShipping,
    installmentsCount,
    installmentAmount,
    installmentsFreeInterest,
  } = input;
  const rate = discountRate;

  const hasCoupon =
    (couponPercent != null && couponPercent > 0) || (couponAmount != null && couponAmount > 0);
  const hasPrime = primeDiscountPercent != null && primeDiscountPercent > 0;
  const hasPix = pixDiscountPercent != null && pixDiscountPercent > 0;
  const hasFull = isFull === true;
  const hasFreeShipping = freeShipping === true;
  const hasInstallments =
    installmentsCount != null && installmentsCount > 1 && installmentAmount != null;
  const hasAnyExtra =
    hasCoupon || hasPrime || hasPix || hasFull || hasFreeShipping || hasInstallments;

  const lines: string[] = [];
  // Bloco 1: nome + uma linha em branco pro título respirar.
  lines.push(`✨ ${nomeProduto}`);
  lines.push("");

  // Bloco 2: preço.
  lines.push(`💰 APROVEITE:${rate > 0 ? ` _${Math.round(rate)}% de DESCONTO!!!!_` : ""} `);
  lines.push(`🔴 De: ~${formatBRL(precoRiscado)}~ `);
  lines.push(`🔥 Por: *${formatBRL(precoPor)}* 😱💸`);

  // Bloco 3: extras (cupom, Prime, Pix, FULL, frete grátis, parcelado) — só
  // renderiza quando há algum, separado por uma linha em branco pra destacar
  // visualmente do preço acima. A ordem segue intensidade do gancho de venda.
  if (hasAnyExtra) {
    lines.push("");
    if (couponPercent != null && couponPercent > 0) {
      lines.push(`🎟️ Cupom de ${Math.round(couponPercent)}% OFF`);
    } else if (couponAmount != null && couponAmount > 0) {
      lines.push(`🎟️ Cupom de ${formatBRL(couponAmount)} OFF`);
    }
    if (hasPrime) {
      lines.push(`💻 Prime: ${Math.round(primeDiscountPercent as number)}% OFF`);
    }
    if (hasPix) {
      lines.push(`💳 ${Math.round(pixDiscountPercent as number)}% OFF no Pix`);
    }
    if (hasFull) {
      lines.push(`⚡ Chega rápido com FULL`);
    }
    if (hasFreeShipping) {
      lines.push(`🚚 Frete grátis`);
    }
    if (hasInstallments) {
      const count = installmentsCount as number;
      const amount = formatBRL(installmentAmount as number);
      const suffix = installmentsFreeInterest ? " sem juros" : "";
      lines.push(`💳 ${count}x ${amount}${suffix}`);
    }
  }

  // Bloco 4: chamada pra ação + link, sempre com uma linha em branco antes
  // pra separar visualmente do conteúdo informativo acima.
  lines.push("");
  lines.push(`🏷️ PROMOÇÃO - CLIQUE NO LINK 👇`);
  lines.push(linkAfiliado);

  return lines.join("\n");
}

export function buildListaOfferWebhookPayload(input: ListaOfferWebhookInput) {
  const {
    precoPor,
    precoRiscado,
    discountRate,
    linkAfiliado,
    imageUrl,
    instanceName,
    hash,
    groupIds,
    couponPercent,
    couponAmount,
    primeDiscountPercent,
    pixDiscountPercent,
    isFull,
    freeShipping,
    installmentsCount,
    installmentAmount,
    installmentsFreeInterest,
  } = input;
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
    // Campos por origem — `null` quando ausente. Cupom é compartilhado;
    // Prime é Amazon-only; Pix/FULL/installments são ML-only.
    couponPercent: couponPercent != null && couponPercent > 0 ? Math.round(couponPercent) : null,
    couponAmount: couponAmount != null && couponAmount > 0 ? couponAmount : null,
    primeDiscountPercent:
      primeDiscountPercent != null && primeDiscountPercent > 0 ? Math.round(primeDiscountPercent) : null,
    pixDiscountPercent:
      pixDiscountPercent != null && pixDiscountPercent > 0 ? Math.round(pixDiscountPercent) : null,
    isFull: isFull === true ? true : null,
    freeShipping: freeShipping === true ? true : null,
    installmentsCount:
      installmentsCount != null && installmentsCount > 1 ? installmentsCount : null,
    installmentAmount:
      installmentAmount != null && installmentAmount > 0 ? installmentAmount : null,
    installmentsFreeInterest: installmentsFreeInterest === true ? true : null,
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
