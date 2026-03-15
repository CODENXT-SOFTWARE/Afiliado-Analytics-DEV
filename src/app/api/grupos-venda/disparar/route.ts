/**
 * Disparar ofertas: para cada keyword busca 1 produto na Shopee, gera link de afiliado
 * e envia ao webhook n8n (que envia para os grupos WhatsApp via Evolution).
 * POST { instanceId, keywords: string[], subId1?, subId2?, subId3? }
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WEBHOOK_URL = "https://n8n.iacodenxt.online/webhook/achadinhoN1";

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

    if (!listaId && !instanceId) return NextResponse.json({ error: "Informe listaId ou instanceId." }, { status: 400 });
    if (keywords.length === 0) return NextResponse.json({ error: "Informe ao menos uma keyword." }, { status: 400 });

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

    const host = req.headers.get("host") ?? "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;
    const cookie = req.headers.get("cookie") ?? "";

    const subIds = [subId1, subId2, subId3].filter(Boolean);
    const instanceName = instance.nome_instancia;
    const hash = instance.hash ?? "";

    const sent: { keyword: string; productName: string; link: string }[] = [];
    const errors: { keyword: string; error: string }[] = [];

    for (const keyword of keywords) {
      try {
        const searchRes = await fetch(
          `${baseUrl}/api/shopee/product-search?keyword=${encodeURIComponent(keyword)}&limit=1&sortType=2`,
          { headers: { cookie } }
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
        const valor = precoPor;
        const formatBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(n);
        const nomeProduto = product.productName ?? "";
        const descricao =
          `✨ ${nomeProduto}\n\n` +
          `💰 APROVEITE:${rate > 0 ? ` _${Math.round(rate)}% de DESCONTO!!!!_` : ""} \n\n  🔴 De: ~${formatBRL(precoRiscado)}~ \n\n  🔥 Por: *${formatBRL(precoPor)}* 😱\n\n` +
          `🏷️ PROMOÇÃO - CLIQUE NO LINK 👇\n\n` +
          linkAfiliado;
        const imagem = product.imageUrl ?? "";

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

        const whRes = await fetch(WEBHOOK_URL, {
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
