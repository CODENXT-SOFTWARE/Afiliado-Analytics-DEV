/**
 * Helpers pra varrer produtos em alta na Shopee Affiliate Open API.
 *
 * Usa o endpoint GraphQL `productOfferV2` com `sortType=8` (vendas decrescentes).
 * As credenciais usadas pelo cron são globais — env vars `SHOPEE_TRENDS_APP_ID`
 * e `SHOPEE_TRENDS_API_KEY` (conta da própria empresa). A conversão para link
 * afiliado de cada usuário acontece em outro fluxo (no clique).
 */

import { buildShopeeAuthorizationHeader } from "./shopee-affiliate-server";

const SHOPEE_GQL = "https://open-api.affiliate.shopee.com.br/graphql";
const PAGE_SIZE = 50; // máximo aceito pela API

export type ShopeeTrendingProduct = {
  itemId: number;
  shopId: number | null;
  productName: string;
  imageUrl: string | null;
  price: number | null;
  priceMin: number | null;
  priceMax: number | null;
  sales: number;
  commissionRate: number | null;
  ratingStar: number | null;
  productLink: string | null;
  offerLink: string | null;
  shopName: string | null;
  categoryIds: number[];
};

type GqlNode = {
  itemId?: number | string;
  shopId?: number | string | null;
  productName?: string;
  imageUrl?: string | null;
  price?: number | string | null;
  priceMin?: number | string | null;
  priceMax?: number | string | null;
  sales?: number | string | null;
  commissionRate?: number | string | null;
  ratingStar?: number | string | null;
  productLink?: string | null;
  offerLink?: string | null;
  shopName?: string | null;
  productCatIds?: (number | string)[] | null;
};

type GqlResponse = {
  data?: {
    productOfferV2?: {
      nodes?: GqlNode[];
      pageInfo?: { hasNextPage?: boolean };
    };
  };
  errors?: { message?: string }[];
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function nodeToProduct(node: GqlNode): ShopeeTrendingProduct | null {
  const itemId = num(node.itemId);
  if (!itemId) return null;
  return {
    itemId,
    shopId: num(node.shopId),
    productName: String(node.productName ?? "").trim(),
    imageUrl: node.imageUrl?.trim() || null,
    price: num(node.price),
    priceMin: num(node.priceMin),
    priceMax: num(node.priceMax),
    sales: num(node.sales) ?? 0,
    commissionRate: num(node.commissionRate),
    ratingStar: num(node.ratingStar),
    productLink: node.productLink?.trim() || null,
    offerLink: node.offerLink?.trim() || null,
    shopName: node.shopName?.trim() || null,
    categoryIds: Array.isArray(node.productCatIds)
      ? node.productCatIds.map((c) => Number(c)).filter((n) => Number.isFinite(n))
      : [],
  };
}

/**
 * Busca uma página de produtos em alta. `sortType=8` = decrescente por vendas.
 */
async function fetchPage(
  appId: string,
  secret: string,
  page: number,
): Promise<{ products: ShopeeTrendingProduct[]; hasNextPage: boolean }> {
  const query = `
    query {
      productOfferV2(sortType: 8, page: ${page}, limit: ${PAGE_SIZE}) {
        nodes {
          itemId
          shopId
          productName
          imageUrl
          price
          priceMin
          priceMax
          sales
          commissionRate
          ratingStar
          productLink
          offerLink
          shopName
          productCatIds
        }
        pageInfo { hasNextPage }
      }
    }
  `;
  const payload = JSON.stringify({ query });
  const Authorization = buildShopeeAuthorizationHeader(appId, secret, payload);
  const res = await fetch(SHOPEE_GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization },
    body: payload,
  });
  const json = (await res.json()) as GqlResponse;
  if (!res.ok || json.errors?.length) {
    throw new Error(json.errors?.[0]?.message ?? `Shopee HTTP ${res.status}`);
  }
  const nodes = json.data?.productOfferV2?.nodes ?? [];
  const products = nodes.map(nodeToProduct).filter((p): p is ShopeeTrendingProduct => p !== null);
  // Se a Shopee não devolver `pageInfo.hasNextPage`, inferimos: lista cheia ⇒
  // provável próxima página; lista incompleta ⇒ acabou.
  const reportedHasNext = json.data?.productOfferV2?.pageInfo?.hasNextPage;
  const hasNextPage =
    typeof reportedHasNext === "boolean" ? reportedHasNext : products.length >= PAGE_SIZE;
  return { products, hasNextPage };
}

/**
 * Coleta os top N produtos em alta (paginando até atingir o alvo ou esgotar).
 * Limite duro de 5 páginas pra evitar abuso de quota se a Shopee mudar paginação.
 */
export async function fetchTrendingProducts(
  appId: string,
  secret: string,
  targetCount = 100,
): Promise<ShopeeTrendingProduct[]> {
  const out: ShopeeTrendingProduct[] = [];
  const seen = new Set<number>();
  for (let page = 0; page < 5 && out.length < targetCount; page++) {
    const { products, hasNextPage } = await fetchPage(appId, secret, page);
    for (const p of products) {
      if (seen.has(p.itemId)) continue;
      seen.add(p.itemId);
      out.push(p);
      if (out.length >= targetCount) break;
    }
    if (!hasNextPage) break;
  }
  return out;
}

/**
 * Calcula o "Score de Viralização" (0-100). Combinação ponderada de:
 *   - vendas absolutas (log-normalizadas) — 50 pts
 *   - comissão — 20 pts
 *   - rating do produto — 15 pts
 *   - preço acessível (faixa onde converte mais) — 15 pts
 *
 * A fórmula é deliberadamente simples: serve como ponto de partida e deve ser
 * recalibrada conforme conversion data real for chegando do nosso conversionReport.
 */
export function computeViralizationScore(p: ShopeeTrendingProduct): number {
  // Vendas: log10 mapeado pra 0-50 (10 vendas → 12, 100 → 25, 1k → 37, 10k → 50)
  const salesPts = p.sales > 0 ? Math.min(50, Math.round((Math.log10(p.sales) / 4) * 50)) : 0;
  // Comissão: 0-20% mapeado linearmente
  const commPts = Math.min(20, Math.round((p.commissionRate ?? 0) * 100));
  // Rating: 4.0 → 7, 4.5 → 11, 5.0 → 15
  const ratingPts = p.ratingStar != null
    ? Math.max(0, Math.min(15, Math.round(((p.ratingStar - 3.5) / 1.5) * 15)))
    : 0;
  // Preço: sweet spot 30-150 ganha 15 pts, fora dessa faixa decai linearmente
  const price = p.price ?? p.priceMin ?? 0;
  let pricePts = 0;
  if (price > 0) {
    if (price >= 30 && price <= 150) pricePts = 15;
    else if (price < 30) pricePts = Math.round((price / 30) * 15);
    else pricePts = Math.max(0, Math.round(15 - ((price - 150) / 1000) * 15));
  }
  return Math.max(0, Math.min(100, salesPts + commPts + ratingPts + pricePts));
}

/**
 * Decide se um produto está "viral" (merece flag visual + push notif).
 * Critério conservador: score alto E muitas vendas.
 */
export function isViralProduct(p: ShopeeTrendingProduct, score: number): boolean {
  return score >= 75 && p.sales >= 100;
}

// ─── Diretório de lojas (logo + nome) ────────────────────────────────────────

export type ShopeeShopDirectoryEntry = {
  shopId: number;
  shopName: string;
  imageUrl: string | null;
  ratingStar: number | null;
};

export type ShopeeCategoryDirectoryEntry = {
  categoryId: number;
  name: string;
};

type ShopGqlNode = {
  offerType?: number | null;
  shopId?: number | string | null;
  shopName?: string | null;
  imageUrl?: string | null;
  ratingStar?: number | string | null;
  // Campos extras pra extrair categorias do mesmo node quando offerType for 2.
  categoryId?: number | string | null;
  offerName?: string | null;
};

type ShopGqlResponse = {
  data?: { shopeeOfferV2?: { nodes?: ShopGqlNode[]; pageInfo?: { hasNextPage?: boolean } } };
  errors?: { message?: string }[];
};

/**
 * Busca o diretório de lojas (e tenta extrair categorias do mesmo endpoint
 * pra reaproveitar a chamada). O `shopeeOfferV2` retorna ofertas mistas (Mall,
 * categoria, loja) — separamos pelos campos preenchidos no node:
 *   - `shopId` + `shopName` + `imageUrl`  → vai pro directory de lojas
 *   - `categoryId` + `offerName`           → vai pro directory de categorias
 *
 * Pra nomes de categorias mais ricos (taxonomia completa, com IDs que casam
 * com `productCatIds` dos produtos), use `fetchCategoryList()` em paralelo —
 * essa query devolve a árvore canônica.
 */
export async function fetchShopeeDirectories(
  appId: string,
  secret: string,
): Promise<{ shops: ShopeeShopDirectoryEntry[]; categories: ShopeeCategoryDirectoryEntry[] }> {
  const query = `
    query {
      shopeeOfferV2(sortType: 1, page: 0, limit: 200) {
        nodes {
          offerType
          shopId
          shopName
          imageUrl
          ratingStar
          categoryId
          offerName
        }
      }
    }
  `;
  const payload = JSON.stringify({ query });
  const Authorization = buildShopeeAuthorizationHeader(appId, secret, payload);
  const res = await fetch(SHOPEE_GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization },
    body: payload,
  });
  const json = (await res.json()) as ShopGqlResponse;
  if (!res.ok || json.errors?.length) {
    throw new Error(json.errors?.[0]?.message ?? `Shopee HTTP ${res.status}`);
  }
  const nodes = json.data?.shopeeOfferV2?.nodes ?? [];

  const shops: ShopeeShopDirectoryEntry[] = [];
  const seenShop = new Set<number>();
  const categories: ShopeeCategoryDirectoryEntry[] = [];
  const seenCategory = new Set<number>();

  for (const n of nodes) {
    // Loja
    const shopId = num(n.shopId);
    const shopName = n.shopName?.trim();
    if (shopId && shopName && !seenShop.has(shopId)) {
      seenShop.add(shopId);
      shops.push({
        shopId,
        shopName,
        imageUrl: n.imageUrl?.trim() || null,
        ratingStar: num(n.ratingStar),
      });
    }
    // Categoria
    const categoryId = num(n.categoryId);
    const categoryName = n.offerName?.trim();
    if (categoryId && categoryName && !seenCategory.has(categoryId)) {
      seenCategory.add(categoryId);
      categories.push({ categoryId, name: categoryName });
    }
  }

  return { shops, categories };
}

/**
 * Busca a taxonomia completa de categorias Shopee (IDs canônicos que casam
 * com `productCatIds` dos produtos no snapshot). Tenta dois endpoints em
 * sequência — o primeiro que responder válido vence:
 *   1. `categoryList { nodes { id name parentId level } }` — quando disponível,
 *      é a fonte oficial e cobre a árvore inteira.
 *   2. Fallback: nada (devolvemos vazio e o caller mantém o que já tinha).
 */
export async function fetchCategoryList(
  appId: string,
  secret: string,
): Promise<ShopeeCategoryDirectoryEntry[]> {
  const query = `
    query {
      categoryList {
        nodes {
          id
          name
          parentId
          level
        }
      }
    }
  `;
  const payload = JSON.stringify({ query });
  const Authorization = buildShopeeAuthorizationHeader(appId, secret, payload);
  let res: Response;
  try {
    res = await fetch(SHOPEE_GQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization },
      body: payload,
    });
  } catch {
    return [];
  }
  type Resp = {
    data?: {
      categoryList?: {
        nodes?: Array<{
          id?: number | string | null;
          name?: string | null;
          parentId?: number | string | null;
          level?: number | null;
        }>;
      };
    };
    errors?: { message?: string }[];
  };
  let json: Resp;
  try {
    json = (await res.json()) as Resp;
  } catch {
    return [];
  }
  if (!res.ok || json.errors?.length) {
    // Endpoint pode não existir nesta versão — retornamos vazio sem propagar
    // erro pra não quebrar o cron principal.
    return [];
  }
  const nodes = json.data?.categoryList?.nodes ?? [];
  const out: ShopeeCategoryDirectoryEntry[] = [];
  const seen = new Set<number>();
  for (const n of nodes) {
    const id = num(n.id);
    const name = n.name?.trim();
    if (!id || !name) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ categoryId: id, name });
  }
  return out;
}
