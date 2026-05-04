/**
 * Fetcher server-side para o `conversionReport` da Shopee Affiliate.
 *
 * Extraído de `src/app/api/shopee/conversion-report/route.ts` para que crons
 * (ex.: coleta diária de comissão para o push das 10:30) consigam reutilizar
 * a mesma lógica de autenticação, paginação por scrollId e parsing.
 *
 * Sem dependência de `Request`/sessão — recebe credenciais já resolvidas e
 * datas já formatadas. Quem chama é responsável por:
 *   - resolver `appId` / `secret` do usuário (em `profiles`)
 *   - converter o range desejado para epoch UNIX em segundos
 *   - tratar erros (lib lança em caso de falha de rede / GraphQL)
 *
 * Não duplicar essa lógica em outros endpoints — preferir importar daqui.
 */

import crypto from "crypto";

const SHOPEE_GQL_ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

type ShopeeGqlError = { message?: string };

type ShopeeItem = {
  itemName?: unknown;
  qty?: unknown;
  itemPrice?: unknown;
  actualAmount?: unknown;
  itemTotalCommission?: unknown;
  attributionType?: unknown;
};

type ShopeeOrder = {
  orderId?: unknown;
  orderStatus?: unknown;
  items?: unknown;
};

type ShopeeNode = {
  purchaseTime?: unknown;
  orders?: unknown;
};

type ShopeePageInfo = {
  hasNextPage?: unknown;
  scrollId?: unknown;
};

type ShopeeGqlResponse = {
  data?: {
    conversionReport?: { nodes?: unknown; pageInfo?: unknown };
  };
  errors?: ShopeeGqlError[];
};

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function safeNumber(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Constrói o header `Authorization` exigido pela Shopee Affiliate.
 * Algoritmo: SHA256(appId + timestamp + payload + secret).
 */
function buildAuthorizationHeader(appId: string, secret: string, payload: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureRaw = `${appId}${timestamp}${payload}${secret}`;
  const signature = crypto.createHash("sha256").update(signatureRaw).digest("hex");
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

async function shopeeGqlFetch(
  appId: string,
  secret: string,
  query: string,
): Promise<ShopeeGqlResponse> {
  const payload = JSON.stringify({ query });
  const Authorization = buildAuthorizationHeader(appId, secret, payload);

  const res = await fetch(SHOPEE_GQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization },
    body: payload,
  });

  const json = (await res.json()) as ShopeeGqlResponse;
  if (!res.ok || json?.errors) {
    const msg = json?.errors?.[0]?.message ?? `Shopee error (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

/** Converte "YYYY-MM-DD" + flag de fim-de-dia em epoch UNIX (segundos), fuso BRT. */
export function brtDateToUnixSeconds(dateYmd: string, endOfDay = false): number {
  const iso = endOfDay ? `${dateYmd}T23:59:59-03:00` : `${dateYmd}T00:00:00-03:00`;
  return Math.floor(new Date(iso).getTime() / 1000);
}

export type ShopeeCommissionTotals = {
  /** Soma da comissão líquida (status earning: completed/pending) em BRL. */
  totalCommission: number;
  /** Quantidade de itens (linhas) somados pra debug. */
  itemCount: number;
};

/**
 * Mantemos o mesmo critério "earning" do dashboard
 * (`src/lib/commissions/buildCommissionAnalytics.ts`): apenas `completed` e
 * `pending` somam comissão. `cancelled`/`unpaid`/`unknown` ficam de fora.
 */
function isEarningStatus(orderStatus: string): boolean {
  const s = orderStatus.toLowerCase().trim();
  return s === "completed" || s === "concluido" || s === "concluida"
    || s === "pending" || s === "pendente";
}

/**
 * Busca a comissão líquida total de um usuário num range BRT.
 *
 * - Pagina automaticamente via scrollId até `hasNextPage = false`.
 * - Soma somente itens cujo `orderStatus` é earning (mesmo critério do
 *   dashboard, garante consistência com o que o user vê na tela).
 * - Limita a 100 páginas (~5000 itens) como salvaguarda contra loop
 *   infinito em caso de bug do scroll. Para o uso "comissão de 1 dia"
 *   isso é folga gigantesca — afiliado top tem ~50-200 itens/dia.
 */
export async function fetchShopeeCommissionTotalForRange(params: {
  appId: string;
  secret: string;
  /** Início do range em epoch UNIX (segundos). */
  purchaseTimeStart: number;
  /** Fim do range em epoch UNIX (segundos). */
  purchaseTimeEnd: number;
}): Promise<ShopeeCommissionTotals> {
  const { appId, secret, purchaseTimeStart, purchaseTimeEnd } = params;

  let totalCommission = 0;
  let itemCount = 0;
  let scrollId: string | null = null;
  let hasNextPage = true;
  let pageGuard = 0;
  const MAX_PAGES = 100;

  while (hasNextPage && pageGuard < MAX_PAGES) {
    pageGuard += 1;
    const scrollArg = scrollId ? `, scrollId: "${scrollId}"` : "";

    const query = `
      query {
        conversionReport(
          purchaseTimeStart: ${purchaseTimeStart},
          purchaseTimeEnd: ${purchaseTimeEnd},
          limit: 50
          ${scrollArg}
        ) {
          nodes {
            purchaseTime
            orders {
              orderId
              orderStatus
              items {
                qty
                itemTotalCommission
              }
            }
          }
          pageInfo { hasNextPage scrollId }
        }
      }
    `;

    const json = await shopeeGqlFetch(appId, secret, query);

    const conn = json?.data?.conversionReport;
    const nodesUnknown = conn?.nodes;
    const pageInfoObj = (conn?.pageInfo ?? {}) as ShopeePageInfo;

    for (const node of asArray<ShopeeNode>(nodesUnknown)) {
      for (const order of asArray<ShopeeOrder>(node.orders)) {
        const orderStatus = String(order.orderStatus ?? "");
        if (!isEarningStatus(orderStatus)) continue;

        for (const item of asArray<ShopeeItem>(order.items)) {
          const qty = safeNumber(item.qty);
          if (qty <= 0) continue;
          const commission = safeNumber(item.itemTotalCommission);
          totalCommission += commission;
          itemCount += 1;
        }
      }
    }

    hasNextPage = !!pageInfoObj.hasNextPage;
    scrollId = (pageInfoObj.scrollId ?? null) as string | null;
    if (!hasNextPage || !scrollId) break;
  }

  return {
    totalCommission: Math.round(totalCommission * 100) / 100,
    itemCount,
  };
}

/**
 * Atalho do uso mais comum: comissão do dia anterior em BRT.
 *
 * `referenceDate` é opcional (default = "agora"); calculamos o "ontem em BRT"
 * a partir dela. Útil tanto para o cron diário quanto para reprocessamento.
 */
export async function fetchShopeeCommissionYesterdayBrt(params: {
  appId: string;
  secret: string;
  referenceDate?: Date;
}): Promise<ShopeeCommissionTotals & { dateBrt: string }> {
  const { appId, secret, referenceDate } = params;

  const ref = referenceDate ?? new Date();
  // BRT = UTC-3. Calcula a "data BRT atual" e subtrai 1 dia.
  const brtNow = new Date(ref.getTime() - 3 * 60 * 60 * 1000);
  const yYear = brtNow.getUTCFullYear();
  const yMonth = brtNow.getUTCMonth();
  const yDay = brtNow.getUTCDate() - 1;
  const yesterdayBrt = new Date(Date.UTC(yYear, yMonth, yDay));
  const yyyy = yesterdayBrt.getUTCFullYear();
  const mm = String(yesterdayBrt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(yesterdayBrt.getUTCDate()).padStart(2, "0");
  const dateBrt = `${yyyy}-${mm}-${dd}`;

  const totals = await fetchShopeeCommissionTotalForRange({
    appId,
    secret,
    purchaseTimeStart: brtDateToUnixSeconds(dateBrt, false),
    purchaseTimeEnd: brtDateToUnixSeconds(dateBrt, true),
  });

  return { ...totals, dateBrt };
}
