/**
 * Disparar ofertas: envia ao webhook n8n (Evolution → grupos).
 * - Modo keywords: para cada keyword busca 1 produto na Shopee e gera link.
 * - Modo lista Shopee: listaOfertasId e sem keywords — um envio por item salvo.
 * - Modo lista ML: listaOfertasMlId e sem keywords — um envio por item (link de afiliado já convertido).
 * POST { listaId | instanceId, keywords?: string[], listaOfertasId?, listaOfertasMlId?, subId1?, subId2?, subId3? }
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

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SavedOfferRow = {
  product_name: string;
  image_url: string;
  price_original: number | null;
  price_promo: number | null;
  discount_rate: number | null;
  converter_link: string;
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
    const listaOfertasInfoId = typeof body.listaOfertasInfoId === "string" ? body.listaOfertasInfoId.trim() : "";

    if (!listaId && !instanceId) return NextResponse.json({ error: "Informe listaId ou instanceId." }, { status: 400 });
    if (!listaOfertasId && !listaOfertasMlId && !listaOfertasInfoId && keywords.length === 0) {
      return NextResponse.json(
        { error: "Informe ao menos uma keyword ou uma lista de ofertas (Shopee, Mercado Livre ou Infoprodutor)." },
        { status: 400 },
      );
    }
    if ((listaOfertasId || listaOfertasMlId || listaOfertasInfoId) && keywords.length > 0) {
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

    const crossoverLista = !!listaOfertasId && !!listaOfertasMlId;
    const listaWebhookUrl = resolveGruposVendaListaWebhookUrl(crossoverLista);

    const dispararListaSalva = async (
      table: "minha_lista_ofertas" | "minha_lista_ofertas_ml",
      fk: string,
      webhookUrl: string,
    ) => {
      const { data: itens, error: qErr } = await supabase
        .from(table)
        .select("product_name, image_url, price_original, price_promo, discount_rate, converter_link")
        .eq("lista_id", fk)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (qErr) {
        errors.push({ keyword: "(lista)", error: qErr.message });
        return;
      }
      const items = (itens ?? []) as SavedOfferRow[];
      if (items.length === 0) {
        errors.push({ keyword: "(lista)", error: "Lista vazia" });
        return;
      }
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const linkAfiliado = item.converter_link?.trim() || "";
        const label = item.product_name?.trim() || `item ${i + 1}`;
        if (!linkAfiliado) {
          errors.push({ keyword: label, error: "Sem link de afiliado" });
          continue;
        }
        const rate = item.discount_rate ?? 0;
        const precoPorResolved =
          effectiveListaOfferPromoPrice(item.price_original, item.price_promo, item.discount_rate) ??
          item.price_promo ??
          0;
        const precoPor = precoPorResolved || 0;
        let precoRiscado = (item.price_original ?? 0) || 0;
        if (precoRiscado <= 0 && precoPor > 0) precoRiscado = precoPor;
        const payload = buildListaOfferWebhookPayload({
          instanceName,
          hash,
          groupIds,
          nomeProduto: item.product_name ?? "",
          imageUrl: item.image_url ?? "",
          precoPor,
          precoRiscado,
          discountRate: rate,
          linkAfiliado,
        });
        const whRes = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!whRes.ok) {
          const whText = await whRes.text();
          errors.push({ keyword: label, error: `Webhook ${whRes.status}: ${whText.slice(0, 100)}` });
          continue;
        }
        sent.push({ keyword: label.slice(0, 40), productName: label.slice(0, 50), link: linkAfiliado });
      }
    };

    const dispararListaInfoprodutor = async (fk: string, webhookUrl: string) => {
      const { data: itens, error: qErr } = await supabase
        .from("minha_lista_ofertas_info")
        .select("product_name, description, image_url, link, price, price_old")
        .eq("lista_id", fk)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (qErr) {
        errors.push({ keyword: "(infoprodutor)", error: qErr.message });
        return;
      }
      type InfoRow = {
        product_name: string;
        description: string | null;
        image_url: string | null;
        link: string;
        price: number | string | null;
        price_old: number | string | null;
      };
      const items = (itens ?? []) as InfoRow[];
      if (items.length === 0) {
        errors.push({ keyword: "(infoprodutor)", error: "Lista vazia" });
        return;
      }
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const link = item.link?.trim() || "";
        const label = item.product_name?.trim() || `item ${i + 1}`;
        if (!link) {
          errors.push({ keyword: label, error: "Produto sem link de venda" });
          continue;
        }
        const preco =
          item.price == null || item.price === ""
            ? null
            : Number.isFinite(Number(item.price))
              ? Number(item.price)
              : null;
        const precoAntigo =
          item.price_old == null || item.price_old === ""
            ? null
            : Number.isFinite(Number(item.price_old))
              ? Number(item.price_old)
              : null;
        const payload = buildInfoprodutorWebhookPayload({
          instanceName,
          hash,
          groupIds,
          nomeProduto: item.product_name ?? "",
          descricaoLivre: item.description ?? "",
          imageUrl: item.image_url ?? "",
          link,
          preco,
          precoAntigo,
        });
        const whRes = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!whRes.ok) {
          const whText = await whRes.text();
          errors.push({ keyword: label, error: `Webhook ${whRes.status}: ${whText.slice(0, 100)}` });
          continue;
        }
        sent.push({ keyword: label.slice(0, 40), productName: label.slice(0, 50), link });
      }
    };

    if (listaOfertasId) {
      await dispararListaSalva("minha_lista_ofertas", listaOfertasId, listaWebhookUrl);
    }
    if (listaOfertasMlId) {
      await dispararListaSalva("minha_lista_ofertas_ml", listaOfertasMlId, listaWebhookUrl);
    }
    if (listaOfertasInfoId) {
      await dispararListaInfoprodutor(listaOfertasInfoId, GRUPOS_VENDA_WEBHOOK_DEFAULT);
    }
    if (listaOfertasId || listaOfertasMlId || listaOfertasInfoId) {
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
