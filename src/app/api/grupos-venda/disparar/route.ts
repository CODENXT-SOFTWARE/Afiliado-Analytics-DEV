/**
 * Disparar ofertas: envia ao webhook n8n (Evolution → grupos).
 * - Modo keywords: para cada keyword busca 1 produto na Shopee e gera link.
 * - Modo lista única (Shopee, ML, Amazon ou Infoprodutor): um envio por item salvo.
 * - Modo crossover N-way: aceita 2 a 4 fontes simultâneas
 *   (`listaOfertasId`, `listaOfertasMlId`, `listaOfertasAmazonId`, `listaOfertasInfoId`)
 *   e alterna 1 item de cada fonte (round-robin) usando `interleaveCrossoverN`.
 * POST {
 *   listaId | instanceId,
 *   keywords?: string[],
 *   listaOfertasId?, listaOfertasMlId?, listaOfertasAmazonId?, listaOfertasInfoId?,
 *   subId1?, subId2?, subId3?
 * }
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import {
  buildListaOfferWebhookPayload,
  buildInfoprodutorWebhookPayload,
  GRUPOS_VENDA_WEBHOOK_DEFAULT,
  resolveGruposVendaListaWebhookUrl,
} from "@/lib/grupos-venda-webhook";
import { effectiveListaOfferPromoPrice } from "@/lib/lista-ofertas-effective-promo";
import { interleaveCrossoverN } from "@/lib/grupos-venda-crossover";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SavedOfferRow = {
  product_name: string;
  image_url: string;
  price_original: number | null;
  price_promo: number | null;
  discount_rate: number | null;
  converter_link: string;
  // Campos extras por marketplace — `coupon_*` existe em Amazon e ML;
  // `prime_*` só em Amazon; `pix_*`/`is_full`/`free_shipping`/installments_*
  // só em ML. Shopee não popula nada disso ainda.
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

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const listaId = typeof body.listaId === "string" ? body.listaId.trim() : "";
    const instanceId = typeof body.instanceId === "string" ? body.instanceId.trim() : "";
    const keywordsRaw = body.keywords;
    const keywords: string[] = Array.isArray(keywordsRaw)
      ? keywordsRaw.map((k: unknown) => String(k).trim()).filter(Boolean)
      : typeof keywordsRaw === "string"
        ? keywordsRaw.split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean)
        : [];
    const subId1 = typeof body.subId1 === "string" ? body.subId1.trim() : "";
    const subId2 = typeof body.subId2 === "string" ? body.subId2.trim() : "";
    const subId3 = typeof body.subId3 === "string" ? body.subId3.trim() : "";
    const listaOfertasId = typeof body.listaOfertasId === "string" ? body.listaOfertasId.trim() : "";
    const listaOfertasMlId = typeof body.listaOfertasMlId === "string" ? body.listaOfertasMlId.trim() : "";
    const listaOfertasAmazonId = typeof body.listaOfertasAmazonId === "string" ? body.listaOfertasAmazonId.trim() : "";
    const listaOfertasInfoId = typeof body.listaOfertasInfoId === "string" ? body.listaOfertasInfoId.trim() : "";

    const hasAnyLista = !!(listaOfertasId || listaOfertasMlId || listaOfertasAmazonId || listaOfertasInfoId);

    if (!listaId && !instanceId) return NextResponse.json({ error: "Informe listaId ou instanceId." }, { status: 400 });
    if (!hasAnyLista && keywords.length === 0) {
      return NextResponse.json(
        { error: "Informe ao menos uma keyword ou uma lista de ofertas (Shopee, Mercado Livre, Amazon ou Infoprodutor)." },
        { status: 400 },
      );
    }
    if (hasAnyLista && keywords.length > 0) {
      return NextResponse.json(
        { error: "Remova as keywords ao disparar por lista de ofertas, ou remova a lista e use só keywords." },
        { status: 400 },
      );
    }

    let instance: { id: string; nome_instancia: string; hash: string | null } | null = null;
    let groupIds: string[] = [];

    if (listaId) {
      const { data: lista } = await supabase
        .from("listas_grupos_venda")
        .select("instance_id")
        .eq("id", listaId)
        .eq("user_id", user.id)
        .single();
      if (!lista) return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
      const instId = (lista as { instance_id: string }).instance_id;
      const { data: inst } = await supabase.from("evolution_instances").select("id, nome_instancia, hash").eq("id", instId).eq("user_id", user.id).single();
      if (!inst) return NextResponse.json({ error: "Instância não encontrada." }, { status: 404 });
      instance = inst as { id: string; nome_instancia: string; hash: string | null };
      const { data: grps } = await supabase.from("grupos_venda").select("group_id").eq("lista_id", listaId);
      groupIds = (grps ?? []).map((g: { group_id: string }) => g.group_id);
    } else {
      const { data: inst } = await supabase.from("evolution_instances").select("id, nome_instancia, hash").eq("id", instanceId).eq("user_id", user.id).single();
      if (!inst) return NextResponse.json({ error: "Instância não encontrada." }, { status: 404 });
      instance = inst as { id: string; nome_instancia: string; hash: string | null };
      const { data: grps } = await supabase.from("grupos_venda").select("group_id").eq("user_id", user.id).eq("instance_id", instanceId);
      groupIds = (grps ?? []).map((g: { group_id: string }) => g.group_id);
    }

    if (groupIds.length === 0) return NextResponse.json({ error: "Nenhum grupo nesta lista (ou instância). Salve grupos na lista primeiro." }, { status: 400 });
    if (!instance) return NextResponse.json({ error: "Instância não resolvida." }, { status: 500 });

    const instanceName = instance.nome_instancia;
    const hash = instance.hash ?? "";

    const host = req.headers.get("host") ?? "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;
    const cookie = req.headers.get("cookie") ?? "";

    const subIds = [subId1, subId2, subId3].filter(Boolean);
    const userId = user.id;

    const sent: { keyword: string; productName: string; link: string }[] = [];
    const errors: { keyword: string; error: string }[] = [];

    // Crossover quando ≥ 2 fontes ativas (Shopee, ML, Amazon, Infoprodutor).
    const activeSourcesCount =
      (listaOfertasId ? 1 : 0) +
      (listaOfertasMlId ? 1 : 0) +
      (listaOfertasAmazonId ? 1 : 0) +
      (listaOfertasInfoId ? 1 : 0);
    const isCrossover = activeSourcesCount >= 2;
    const listaWebhookUrl = resolveGruposVendaListaWebhookUrl(isCrossover);

    type AffiliateOfferTable =
      | "minha_lista_ofertas"
      | "minha_lista_ofertas_ml"
      | "minha_lista_ofertas_amazon";

    const carregarItensListaSalva = async (
      table: AffiliateOfferTable,
      fk: string,
    ): Promise<SavedOfferRow[]> => {
      // Cada tabela tem colunas extras diferentes — pegamos só as que
      // existem pra evitar erro "column does not exist" em Shopee.
      const cols =
        table === "minha_lista_ofertas_amazon"
          ? "product_name, image_url, price_original, price_promo, discount_rate, converter_link, coupon_percent, coupon_amount, prime_discount_percent"
          : table === "minha_lista_ofertas_ml"
            ? "product_name, image_url, price_original, price_promo, discount_rate, converter_link, coupon_percent, coupon_amount, pix_discount_percent, is_full, free_shipping, installments_count, installment_amount, installments_free_interest"
            : "product_name, image_url, price_original, price_promo, discount_rate, converter_link";
      const { data: itens, error: qErr } = await supabase
        .from(table)
        .select(cols)
        .eq("lista_id", fk)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (qErr) {
        errors.push({ keyword: "(lista)", error: qErr.message });
        return [];
      }
      // Cast via unknown porque o Supabase TypeScript não consegue inferir
      // colunas a partir de uma string condicional (cols varia por tabela).
      return (itens ?? []) as unknown as SavedOfferRow[];
    };

    type InfoRow = {
      product_name: string;
      description: string | null;
      image_url: string | null;
      link: string;
      price: number | string | null;
      price_old: number | string | null;
    };

    const carregarItensInfoprodutor = async (fk: string): Promise<InfoRow[]> => {
      const { data: itens, error: qErr } = await supabase
        .from("minha_lista_ofertas_info")
        .select("product_name, description, image_url, link, price, price_old")
        .eq("lista_id", fk)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (qErr) {
        errors.push({ keyword: "(infoprodutor)", error: qErr.message });
        return [];
      }
      return (itens ?? []) as InfoRow[];
    };

    /**
     * Fila normalizada do crossover: cada item já carrega o tipo de origem,
     * o que define qual webhook (lista vs infoprodutor) e qual builder de
     * payload usar na hora de disparar.
     */
    type QueueItem =
      | { source: "shopee" | "ml" | "amazon"; row: SavedOfferRow }
      | { source: "infoprodutor"; row: InfoRow };

    const dispararQueueItem = async (item: QueueItem, fallbackLabel: string) => {
      if (item.source === "infoprodutor") {
        const row = item.row;
        const link = row.link?.trim() || "";
        const label = row.product_name?.trim() || fallbackLabel;
        if (!link) {
          errors.push({ keyword: label, error: "Produto sem link de venda" });
          return;
        }
        const preco =
          row.price == null || row.price === ""
            ? null
            : Number.isFinite(Number(row.price))
              ? Number(row.price)
              : null;
        const precoAntigo =
          row.price_old == null || row.price_old === ""
            ? null
            : Number.isFinite(Number(row.price_old))
              ? Number(row.price_old)
              : null;
        const payload = buildInfoprodutorWebhookPayload({
          instanceName,
          hash,
          groupIds,
          nomeProduto: row.product_name ?? "",
          descricaoLivre: row.description ?? "",
          imageUrl: row.image_url ?? "",
          link,
          preco,
          precoAntigo,
        });
        const whRes = await fetch(GRUPOS_VENDA_WEBHOOK_DEFAULT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!whRes.ok) {
          const whText = await whRes.text();
          errors.push({ keyword: label, error: `Webhook ${whRes.status}: ${whText.slice(0, 100)}` });
          return;
        }
        sent.push({ keyword: label.slice(0, 40), productName: label.slice(0, 50), link });
        return;
      }

      // shopee | ml | amazon: payload de "lista de oferta"
      const row = item.row;
      const linkAfiliado = row.converter_link?.trim() || "";
      const label = row.product_name?.trim() || fallbackLabel;
      if (!linkAfiliado) {
        errors.push({ keyword: label, error: "Sem link de afiliado" });
        return;
      }
      const rate = row.discount_rate ?? 0;
      const precoPorResolved =
        effectiveListaOfferPromoPrice(row.price_original, row.price_promo, row.discount_rate) ??
        row.price_promo ??
        0;
      const precoPor = precoPorResolved || 0;
      let precoRiscado = (row.price_original ?? 0) || 0;
      if (precoRiscado <= 0 && precoPor > 0) precoRiscado = precoPor;
      // Cada marketplace tem seu conjunto de campos extras (selecionados
      // condicionalmente em `carregarItensListaSalva`). Cupom é compartilhado
      // entre Amazon e ML; Prime é Amazon-only; Pix/FULL/installments são
      // ML-only. Shopee ainda não popula nada.
      const isAmazon = item.source === "amazon";
      const isMl = item.source === "ml";
      const payload = buildListaOfferWebhookPayload({
        instanceName,
        hash,
        groupIds,
        nomeProduto: row.product_name ?? "",
        imageUrl: row.image_url ?? "",
        precoPor,
        precoRiscado,
        discountRate: rate,
        linkAfiliado,
        couponPercent: isAmazon || isMl ? row.coupon_percent ?? null : null,
        couponAmount: isAmazon || isMl ? row.coupon_amount ?? null : null,
        primeDiscountPercent: isAmazon ? row.prime_discount_percent ?? null : null,
        pixDiscountPercent: isMl ? row.pix_discount_percent ?? null : null,
        isFull: isMl ? row.is_full ?? null : null,
        freeShipping: isMl ? row.free_shipping ?? null : null,
        installmentsCount: isMl ? row.installments_count ?? null : null,
        installmentAmount: isMl ? row.installment_amount ?? null : null,
        installmentsFreeInterest: isMl ? row.installments_free_interest ?? null : null,
      });
      const whRes = await fetch(listaWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!whRes.ok) {
        const whText = await whRes.text();
        errors.push({ keyword: label, error: `Webhook ${whRes.status}: ${whText.slice(0, 100)}` });
        return;
      }
      sent.push({ keyword: label.slice(0, 40), productName: label.slice(0, 50), link: linkAfiliado });
    };

    if (hasAnyLista) {
      // Carrega todas as fontes em paralelo, normaliza pra QueueItem e
      // intercala com `interleaveCrossoverN`. Para 1 fonte só, vira lista única.
      const [shopeeRows, mlRows, amazonRows, infoRows] = await Promise.all([
        listaOfertasId
          ? carregarItensListaSalva("minha_lista_ofertas", listaOfertasId)
          : Promise.resolve([] as SavedOfferRow[]),
        listaOfertasMlId
          ? carregarItensListaSalva("minha_lista_ofertas_ml", listaOfertasMlId)
          : Promise.resolve([] as SavedOfferRow[]),
        listaOfertasAmazonId
          ? carregarItensListaSalva("minha_lista_ofertas_amazon", listaOfertasAmazonId)
          : Promise.resolve([] as SavedOfferRow[]),
        listaOfertasInfoId
          ? carregarItensInfoprodutor(listaOfertasInfoId)
          : Promise.resolve([] as InfoRow[]),
      ]);

      const shopeeQ: QueueItem[] = shopeeRows.map((row) => ({ source: "shopee", row }));
      const mlQ: QueueItem[] = mlRows.map((row) => ({ source: "ml", row }));
      const amazonQ: QueueItem[] = amazonRows.map((row) => ({ source: "amazon", row }));
      const infoQ: QueueItem[] = infoRows.map((row) => ({ source: "infoprodutor", row }));

      const queue = interleaveCrossoverN(shopeeQ, mlQ, amazonQ, infoQ);
      if (queue.length === 0) {
        errors.push({ keyword: "(lista)", error: "Listas vazias" });
      } else {
        for (let i = 0; i < queue.length; i++) {
          await dispararQueueItem(queue[i], `item ${i + 1}`);
        }
      }

      return NextResponse.json({
        success: true,
        sent: sent.length,
        sentDetail: sent,
        errors: errors.length ? errors : undefined,
      });
    }

    for (const keyword of keywords) {
      try {
        const searchRes = await fetch(
          `${baseUrl}/api/shopee/product-search?keyword=${encodeURIComponent(keyword)}&limit=1&sortType=2`,
          { headers: { cookie } },
        );
        const searchData = await searchRes.json();
        if (!searchRes.ok) throw new Error(searchData?.error ?? "Falha ao buscar produto");
        const products = searchData?.products ?? [];
        const product = products[0];
        if (!product) {
          errors.push({ keyword, error: "Nenhum produto encontrado" });
          continue;
        }

        const originUrl = product.productLink || product.offerLink || "";
        if (!originUrl) {
          errors.push({ keyword, error: "Produto sem link" });
          continue;
        }

        const linkRes = await fetch(`${baseUrl}/api/shopee/generate-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie },
          body: JSON.stringify({ originUrl, subIds }),
        });
        const linkData = await linkRes.json();
        if (!linkRes.ok) throw new Error(linkData?.error ?? "Falha ao gerar link");
        const linkAfiliado = linkData?.shortLink ?? "";

        const priceMin = product.priceMin ?? 0;
        const priceMax = product.priceMax ?? 0;
        const rate = product.priceDiscountRate ?? 0;
        const precoPor = priceMin || priceMax;
        const precoRiscado =
          rate > 0 && rate < 100 && priceMin > 0
            ? Math.round((priceMin / (1 - rate / 100)) * 100) / 100
            : priceMax || 0;
        const formatBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(n);
        const nomeProduto = product.productName ?? "";
        const descricao =
          `✨ ${nomeProduto}\n` +
          `💰 APROVEITE:${rate > 0 ? ` _${Math.round(rate)}% de DESCONTO!!!!_` : ""} \n🔴 De: ~${formatBRL(precoRiscado)}~ \n🔥 Por: *${formatBRL(precoPor)}* 😱\n` +
          `🏷️ PROMOÇÃO - CLIQUE NO LINK 👇\n` +
          linkAfiliado;
        const imagem = product.imageUrl ?? "";
        const valor = precoPor;

        const payload = {
          instanceName,
          hash,
          groupIds,
          imagem,
          descricao,
          valor,
          linkAfiliado,
          desconto: rate > 0 ? Math.round(rate) : null,
          precoRiscado: precoRiscado > 0 ? precoRiscado : null,
          precoPor: precoPor > 0 ? precoPor : null,
        };

        const whRes = await fetch(GRUPOS_VENDA_WEBHOOK_DEFAULT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!whRes.ok) {
          const whText = await whRes.text();
          errors.push({ keyword, error: `Webhook ${whRes.status}: ${whText.slice(0, 100)}` });
          continue;
        }

        sent.push({ keyword, productName: descricao.slice(0, 50), link: linkAfiliado });
      } catch (e) {
        errors.push({ keyword, error: e instanceof Error ? e.message : "Erro ao processar" });
      }
    }

    return NextResponse.json({
      success: true,
      sent: sent.length,
      sentDetail: sent,
      errors: errors.length ? errors : undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao disparar" }, { status: 500 });
  }
}
