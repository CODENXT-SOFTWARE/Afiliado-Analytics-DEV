/**
 * Cron Telegram: dispara automações ativas com janela válida.
 * Mesmo padrão do cron WhatsApp (`/api/grupos-venda/cron-disparo`), mas:
 *   - lê de telegram_grupos_venda_continuo
 *   - resolve grupos via telegram_grupos_venda
 *   - envia direto via Telegram Bot API (sendPayloadToChats), sem n8n
 *
 * Modos suportados:
 *   - Keywords (Shopee API ao vivo)
 *   - Lista de ofertas Shopee (`minha_lista_ofertas`)
 *   - Lista de ofertas Mercado Livre (`minha_lista_ofertas_ml`)
 *   - Lista Infoprodutor (`minha_lista_ofertas_info`)
 *
 * Auth:
 *   - GET (Vercel cron): exige `Authorization: Bearer ${CRON_SECRET}` em produção.
 *   - POST (teste manual no painel): exige usuário logado; aceita opcionalmente
 *     { configId } pra testar uma única automação.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "utils/supabase/server";
import { mensagemErroJanela } from "@/lib/grupos-venda-janela";
import { effectiveListaOfferPromoPrice } from "@/lib/lista-ofertas-effective-promo";
import { sendPayloadToChats } from "@/lib/telegram/send";
import {
  buildInfoprodutorMessage,
  buildListaOfferMessage,
  buildShopeeKeywordMessage,
} from "@/lib/telegram/messages";
import {
  generateShopeeAffiliateLink,
  pickProductFromPool,
  searchShopeeProducts,
} from "@/lib/telegram/shopee-search";
import { interleaveCrossoverN } from "@/lib/grupos-venda-crossover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 55;

/** Verifica se o horário atual em Brasília (UTC-3) está dentro da janela. */
function isWithinBrasiliaWindow(horarioInicio: string | null, horarioFim: string | null): boolean {
  if (!horarioInicio || !horarioFim) return true;
  const now = new Date();
  const brasiliaMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() - 180 + 1440) % 1440;
  const [startH, startM] = horarioInicio.split(":").map(Number);
  const [endH, endM] = horarioFim.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  if (startMinutes <= endMinutes) {
    return brasiliaMinutes >= startMinutes && brasiliaMinutes <= endMinutes;
  }
  return brasiliaMinutes >= startMinutes || brasiliaMinutes <= endMinutes;
}

type CronResultEntry = {
  userId: string;
  keyword?: string;
  ok: boolean;
  sent?: number;
  failed?: number;
  error?: string;
};

type CronResultBody =
  | { ok: true; processed: 0; message: string }
  | { ok: true; processed: number; results: CronResultEntry[] };

type CronRunOptions = {
  manualUserId?: string | null;
  skipWindowCheck?: boolean;
  singleConfigId?: string | null;
};

async function runCronDisparoTelegram(opts?: CronRunOptions): Promise<CronResultBody> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const sel =
    "id, user_id, bot_id, lista_id, lista_ofertas_id, lista_ofertas_ml_id, lista_ofertas_amazon_id, lista_ofertas_info_id, keywords, sub_id_1, sub_id_2, sub_id_3, proximo_indice, keyword_pool_indices, horario_inicio, horario_fim";

  let configQuery = supabase.from("telegram_grupos_venda_continuo").select(sel);
  if (opts?.singleConfigId && opts.manualUserId) {
    configQuery = configQuery.eq("id", opts.singleConfigId).eq("user_id", opts.manualUserId);
  } else {
    configQuery = configQuery.eq("ativo", true);
    if (opts?.manualUserId) configQuery = configQuery.eq("user_id", opts.manualUserId);
  }

  const { data: configs, error: configError } = await configQuery;

  if (configError) return { ok: true, processed: 0, message: configError.message };
  if (!configs?.length) {
    if (opts?.singleConfigId) {
      return { ok: true, processed: 0, message: "Automação não encontrada ou sem permissão." };
    }
    return { ok: true, processed: 0, message: "Nenhum disparo ativo" };
  }

  const results: CronResultEntry[] = [];

  for (const cfg of configs as Array<{
    id: string;
    user_id: string;
    bot_id: string;
    lista_id: string | null;
    lista_ofertas_id: string | null;
    lista_ofertas_ml_id: string | null;
    lista_ofertas_amazon_id: string | null;
    lista_ofertas_info_id: string | null;
    keywords: string[];
    sub_id_1: string;
    sub_id_2: string;
    sub_id_3: string;
    proximo_indice: number;
    keyword_pool_indices: unknown;
    horario_inicio: string | null;
    horario_fim: string | null;
  }>) {
    const userId = cfg.user_id;
    const botId = cfg.bot_id;
    const listaId = cfg.lista_id;
    const listaOfertasId = cfg.lista_ofertas_id;
    const listaOfertasMlId = cfg.lista_ofertas_ml_id;
    const listaOfertasAmazonId = cfg.lista_ofertas_amazon_id;
    const listaOfertasInfoId = cfg.lista_ofertas_info_id;
    const keywords = Array.isArray(cfg.keywords) ? cfg.keywords : [];
    const proximoIndice = Number(cfg.proximo_indice) || 0;
    const subIds = [cfg.sub_id_1, cfg.sub_id_2, cfg.sub_id_3].filter(Boolean);
    const horarioInicio = cfg.horario_inicio;
    const horarioFim = cfg.horario_fim;

    // Janela horária obrigatória
    if (!horarioInicio?.trim() || !horarioFim?.trim()) {
      results.push({ userId, ok: true, error: "Sem janela — configure início e fim no app (máx. 14 h)" });
      continue;
    }
    const janelaInv = mensagemErroJanela(horarioInicio, horarioFim);
    if (janelaInv) {
      results.push({ userId, ok: true, error: janelaInv });
      continue;
    }
    if (!opts?.skipWindowCheck && !isWithinBrasiliaWindow(horarioInicio, horarioFim)) {
      results.push({ userId, ok: true, error: "Fora do horário configurado" });
      continue;
    }

    const isListaOfertasMode = !!listaOfertasId || !!listaOfertasMlId || !!listaOfertasAmazonId;
    const isListaInfoMode = !!listaOfertasInfoId;
    if (!isListaOfertasMode && !isListaInfoMode && keywords.length === 0) {
      results.push({ userId, ok: false, error: "Sem keywords" });
      continue;
    }

    try {
      // Resolve bot (token + ativo)
      const { data: bot } = await supabase
        .from("telegram_bots")
        .select("bot_token, ativo")
        .eq("id", botId)
        .single();
      const botRow = bot as { bot_token?: string; ativo?: boolean } | null;
      if (!botRow?.bot_token) {
        results.push({ userId, ok: false, error: "Bot não encontrado" });
        continue;
      }
      if (!botRow.ativo) {
        results.push({ userId, ok: false, error: "Bot desativado" });
        continue;
      }
      const botToken = botRow.bot_token;

      // Resolve grupos da lista (Telegram requer lista_id sempre — o continuo POST exige)
      const { data: groups } = listaId
        ? await supabase.from("telegram_grupos_venda").select("chat_id").eq("lista_id", listaId)
        : { data: [] as { chat_id: string }[] };
      const chatIds = (groups ?? []).map((g: { chat_id: string }) => g.chat_id);
      if (chatIds.length === 0) {
        results.push({ userId, ok: false, error: "Nenhum grupo na lista" });
        continue;
      }

      // ── Modo lista (Shopee + ML + Amazon + Info, com crossover N-way) ──────
      if (isListaOfertasMode || isListaInfoMode) {
        type ListaRow = {
          product_name: string;
          image_url: string;
          price_original: number | null;
          price_promo: number | null;
          discount_rate: number | null;
          converter_link: string;
          // Campos extras por marketplace — ver disparar/route.ts.
          coupon_percent?: number | null;
          coupon_amount?: number | null;
          prime_discount_percent?: number | null;
          pix_discount_percent?: number | null;
          is_full?: boolean | null;
          free_shipping?: boolean | null;
          installments_count?: number | null;
          installment_amount?: number | null;
          installments_free_interest?: boolean | null;
        };
        type InfoRow = {
          product_name: string;
          description: string | null;
          image_url: string | null;
          link: string;
          price: number | string | null;
          price_old: number | string | null;
        };
        // `kind` distingue Shopee/ML/Amazon dentro de "lista" — usado pra
        // decidir se passa cupom/Prime pro builder (só vale pra Amazon hoje).
        type QueueItem =
          | { source: "lista"; kind: "shopee" | "ml" | "amazon"; row: ListaRow }
          | { source: "info"; row: InfoRow };

        const fetchLista = async (
          table: "minha_lista_ofertas" | "minha_lista_ofertas_ml" | "minha_lista_ofertas_amazon",
          listaId: string,
        ): Promise<ListaRow[]> => {
          // Cada tabela tem colunas extras diferentes — ver disparar/route.ts.
          const cols =
            table === "minha_lista_ofertas_amazon"
              ? "id, product_name, image_url, price_original, price_promo, discount_rate, converter_link, coupon_percent, coupon_amount, prime_discount_percent"
              : table === "minha_lista_ofertas_ml"
                ? "id, product_name, image_url, price_original, price_promo, discount_rate, converter_link, coupon_percent, coupon_amount, pix_discount_percent, is_full, free_shipping, installments_count, installment_amount, installments_free_interest"
                : "id, product_name, image_url, price_original, price_promo, discount_rate, converter_link";
          const { data } = await supabase
            .from(table)
            .select(cols)
            .eq("lista_id", listaId)
            .eq("user_id", userId)
            .order("created_at", { ascending: true });
          // Cast via unknown porque o Supabase TypeScript não consegue inferir
          // colunas a partir de uma string condicional.
          return (data ?? []) as unknown as ListaRow[];
        };
        const [shopeeItems, mlItems, amazonItems, infoItemsRaw] = await Promise.all([
          listaOfertasId ? fetchLista("minha_lista_ofertas", listaOfertasId) : Promise.resolve([] as ListaRow[]),
          listaOfertasMlId ? fetchLista("minha_lista_ofertas_ml", listaOfertasMlId) : Promise.resolve([] as ListaRow[]),
          listaOfertasAmazonId ? fetchLista("minha_lista_ofertas_amazon", listaOfertasAmazonId) : Promise.resolve([] as ListaRow[]),
          listaOfertasInfoId
            ? supabase
                .from("minha_lista_ofertas_info")
                .select("id, product_name, description, image_url, link, price, price_old")
                .eq("lista_id", listaOfertasInfoId)
                .eq("user_id", userId)
                .order("created_at", { ascending: true })
                .then((r) => (r.data ?? []) as InfoRow[])
            : Promise.resolve([] as InfoRow[]),
        ]);

        const shopeeQ: QueueItem[] = shopeeItems.map((row) => ({ source: "lista", kind: "shopee", row }));
        const mlQ: QueueItem[] = mlItems.map((row) => ({ source: "lista", kind: "ml", row }));
        const amazonQ: QueueItem[] = amazonItems.map((row) => ({ source: "lista", kind: "amazon", row }));
        const infoQ: QueueItem[] = infoItemsRaw.map((row) => ({ source: "info", row }));

        const queue = interleaveCrossoverN<QueueItem>(shopeeQ, mlQ, amazonQ, infoQ);
        if (queue.length === 0) {
          results.push({ userId, ok: false, error: "Lista de ofertas vazia" });
          continue;
        }

        const idx = proximoIndice % queue.length;
        const nextIndex = (proximoIndice + 1) % queue.length;
        const item = queue[idx];

        let text = "";
        let imageUrl: string | undefined;
        let nomeKeyword = "";

        if (item.source === "info") {
          const r = item.row;
          const link = r.link?.trim() || "";
          if (!link) {
            results.push({ userId, ok: false, error: "Produto sem link" });
            await supabase
              .from("telegram_grupos_venda_continuo")
              .update({ proximo_indice: nextIndex, updated_at: new Date().toISOString() })
              .eq("id", cfg.id);
            continue;
          }
          const preco = r.price == null || r.price === "" ? null : Number.isFinite(Number(r.price)) ? Number(r.price) : null;
          const precoAntigo = r.price_old == null || r.price_old === ""
            ? null
            : Number.isFinite(Number(r.price_old)) ? Number(r.price_old) : null;
          text = buildInfoprodutorMessage({
            nomeProduto: r.product_name ?? "",
            descricaoLivre: r.description ?? "",
            link,
            preco,
            precoAntigo,
          });
          imageUrl = r.image_url?.trim() || undefined;
          nomeKeyword = (r.product_name ?? "").slice(0, 30);
        } else {
          const r = item.row;
          const linkAfiliado = r.converter_link?.trim() || "";
          if (!linkAfiliado) {
            results.push({ userId, ok: false, error: "Produto sem link" });
            await supabase
              .from("telegram_grupos_venda_continuo")
              .update({ proximo_indice: nextIndex, updated_at: new Date().toISOString() })
              .eq("id", cfg.id);
            continue;
          }
          const nomeProduto = r.product_name ?? "";
          const rate = r.discount_rate ?? 0;
          const precoPorResolved =
            effectiveListaOfferPromoPrice(r.price_original, r.price_promo, r.discount_rate) ??
            r.price_promo ??
            0;
          const precoPor = precoPorResolved || 0;
          const precoRiscado = (r.price_original ?? precoPor) || 0;
          // Cada marketplace traz seu conjunto de campos.
          const isAmazon = item.kind === "amazon";
          const isMl = item.kind === "ml";
          text = buildListaOfferMessage({
            nomeProduto,
            precoPor,
            precoRiscado,
            discountRate: rate,
            linkAfiliado,
            couponPercent: isAmazon || isMl ? r.coupon_percent ?? null : null,
            couponAmount: isAmazon || isMl ? r.coupon_amount ?? null : null,
            primeDiscountPercent: isAmazon ? r.prime_discount_percent ?? null : null,
            pixDiscountPercent: isMl ? r.pix_discount_percent ?? null : null,
            isFull: isMl ? r.is_full ?? null : null,
            freeShipping: isMl ? r.free_shipping ?? null : null,
            installmentsCount: isMl ? r.installments_count ?? null : null,
            installmentAmount: isMl ? r.installment_amount ?? null : null,
            installmentsFreeInterest: isMl ? r.installments_free_interest ?? null : null,
          });
          imageUrl = r.image_url?.trim() || undefined;
          nomeKeyword = nomeProduto.slice(0, 30);
        }

        const sendResults = await sendPayloadToChats(botToken, chatIds, { text, imageUrl });
        const sent = sendResults.filter((r) => r.ok).length;
        const failed = sendResults.length - sent;
        results.push({ userId, keyword: nomeKeyword, ok: sent > 0, sent, failed });

        await supabase
          .from("telegram_grupos_venda_continuo")
          .update({
            proximo_indice: nextIndex,
            ultimo_disparo_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", cfg.id);
        continue;
      }

      // ── Modo keywords (Shopee API ao vivo) ──────────────────────────────────
      const keyword = keywords[proximoIndice % keywords.length];
      const nextIndex = (proximoIndice + 1) % keywords.length;

      const { data: profile } = await supabase
        .from("profiles")
        .select("shopee_app_id, shopee_api_key")
        .eq("id", userId)
        .single();
      const appId = (profile as { shopee_app_id?: string } | null)?.shopee_app_id?.trim();
      const secret = (profile as { shopee_api_key?: string } | null)?.shopee_api_key?.trim();
      if (!appId || !secret) {
        results.push({ userId, keyword, ok: false, error: "Shopee não configurado" });
        await supabase
          .from("telegram_grupos_venda_continuo")
          .update({
            proximo_indice: nextIndex,
            ultimo_disparo_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", cfg.id);
        continue;
      }

      const nodes = await searchShopeeProducts(appId, secret, keyword, 30);

      const rawIndices = cfg.keyword_pool_indices;
      const keywordPoolIndices: Record<string, number> =
        rawIndices && typeof rawIndices === "object" && !Array.isArray(rawIndices)
          ? (rawIndices as Record<string, number>)
          : {};
      const n = Number.isFinite(keywordPoolIndices[keyword]) ? keywordPoolIndices[keyword]! : 0;
      const { product, poolSize } = pickProductFromPool(nodes, n);
      if (!product || poolSize === 0) {
        results.push({ userId, keyword, ok: false, error: "Nenhum produto encontrado" });
        await supabase
          .from("telegram_grupos_venda_continuo")
          .update({
            proximo_indice: nextIndex,
            ultimo_disparo_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", cfg.id);
        continue;
      }
      const originUrl = product.productLink || product.offerLink || "";
      if (!originUrl) {
        results.push({ userId, keyword, ok: false, error: "Produto sem URL" });
        await supabase
          .from("telegram_grupos_venda_continuo")
          .update({
            proximo_indice: nextIndex,
            ultimo_disparo_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", cfg.id);
        continue;
      }

      const linkAfiliado = await generateShopeeAffiliateLink(appId, secret, originUrl, subIds);
      if (!linkAfiliado) {
        results.push({ userId, keyword, ok: false, error: "Falha ao gerar link" });
        await supabase
          .from("telegram_grupos_venda_continuo")
          .update({ proximo_indice: nextIndex, updated_at: new Date().toISOString() })
          .eq("id", cfg.id);
        continue;
      }

      const priceMin = product.priceMin ?? 0;
      const priceMax = product.priceMax ?? 0;
      const rate = product.priceDiscountRate ?? 0;
      const precoPor = priceMin || priceMax;
      const precoRiscado =
        rate > 0 && rate < 100 && priceMin > 0
          ? Math.round((priceMin / (1 - rate / 100)) * 100) / 100
          : priceMax || 0;

      const text = buildShopeeKeywordMessage({
        nomeProduto: product.productName ?? "",
        precoPor,
        precoRiscado,
        discountRate: rate,
        linkAfiliado,
      });
      const sendResults = await sendPayloadToChats(botToken, chatIds, {
        text,
        imageUrl: product.imageUrl?.trim() || undefined,
      });
      const sent = sendResults.filter((r) => r.ok).length;
      const failed = sendResults.length - sent;
      results.push({ userId, keyword, ok: sent > 0, sent, failed });

      // Avança índices: keyword_pool_indices só avança se mandou OK
      const nextKeywordPoolIndices = sent > 0 ? { ...keywordPoolIndices, [keyword]: n + 1 } : keywordPoolIndices;
      await supabase
        .from("telegram_grupos_venda_continuo")
        .update({
          proximo_indice: nextIndex,
          ...(sent > 0 ? { keyword_pool_indices: nextKeywordPoolIndices } : {}),
          ultimo_disparo_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", cfg.id);
    } catch (e) {
      results.push({ userId, ok: false, error: e instanceof Error ? e.message : "Erro" });
    }
  }

  return { ok: true, processed: configs.length, results };
}

/**
 * Cron Vercel — exige Bearer CRON_SECRET em produção.
 */
export async function GET(req: NextRequest) {
  const onVercel = process.env.VERCEL === "1";
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  if (onVercel) {
    if (!cronSecret) {
      return NextResponse.json(
        {
          error:
            "CRON_SECRET não configurado na Vercel. Adicione em Settings → Environment Variables e faça redeploy.",
        },
        { status: 503 }
      );
    }
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const body = await runCronDisparoTelegram();
  return NextResponse.json(body);
}

/**
 * Teste manual — exige usuário logado. Aceita { configId } pra testar uma única automação.
 */
export async function POST(req: NextRequest) {
  const supabaseAuth = await createServerClient();
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  const {
    data: { user },
  } = bearer ? await supabaseAuth.auth.getUser(bearer) : await supabaseAuth.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let configId = "";
  try {
    const raw = (await req.json()) as unknown;
    if (raw && typeof raw === "object" && "configId" in raw) {
      const v = (raw as { configId?: unknown }).configId;
      if (typeof v === "string") configId = v.trim();
    }
  } catch {
    /* corpo vazio: teste geral */
  }

  const body = await runCronDisparoTelegram({
    manualUserId: user.id,
    skipWindowCheck: true,
    singleConfigId: configId || null,
  });
  return NextResponse.json(body);
}
