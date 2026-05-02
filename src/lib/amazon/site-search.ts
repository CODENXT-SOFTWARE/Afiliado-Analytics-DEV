/**
 * Espelho do `@/lib/mercadolivre/site-search` pra Amazon.
 *
 * Hoje só exporta o tipo `MlSiteSearchProduct` (mantemos o nome pra reusar
 * o clone visual da página ML 1:1) e helpers de filtro/enriquecimento como
 * stubs no-op. Quando a busca real Amazon for plugada (PA-API ou scraping
 * com cookie da extensão), basta substituir o body destes helpers — a
 * assinatura permanece a mesma.
 */

export type MlSiteSearchProduct = {
  itemId: string;
  productName: string;
  productLink: string;
  imageUrl: string;
  price: number | null;
  priceOriginal: number | null;
  discountRate: number | null;
  currencyId: string;
  affiliateCommissionPct?: number | null;
  /** Cupom em % (1–99) quando aplicável; null se não houver. */
  couponPercent?: number | null;
  /** Cupom de valor fixo em R$ quando aplicável; null se não houver. */
  couponAmount?: number | null;
  /** % de desconto Prime (1ª compra, exclusivo). null se ausente. */
  primeDiscountPercent?: number | null;
};

export function filterValidMlSiteSearchProducts(
  products: MlSiteSearchProduct[],
): MlSiteSearchProduct[] {
  return (products ?? []).filter((p) => p.itemId && p.productName);
}

export function isMlSocialListsProfileUrl(_url: string): boolean {
  // Conceito de "social lists" não existe na Amazon; sempre falso.
  return false;
}

export async function fetchMlSiteSearchWithSession(_args: {
  query: string;
  cookieHeader: string;
  limit?: number;
}): Promise<MlSiteSearchProduct[]> {
  return [];
}

export async function fetchMlSiteCategoryWithSession(_args: {
  categorySlug: string;
  cookieHeader: string;
  limit?: number;
}): Promise<MlSiteSearchProduct[]> {
  return [];
}

export async function enrichMlSiteSearchProductsFromPdp(
  products: MlSiteSearchProduct[],
  _cookieHeader: string,
): Promise<MlSiteSearchProduct[]> {
  return products;
}
