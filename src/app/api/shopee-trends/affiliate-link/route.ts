/**
 * Converte um produto da snapshot de tendências em link afiliado do usuário
 * autenticado E persiste no histórico (`shopee_link_history`) — assim o link
 * gerado aparece automaticamente na seção "Links Gerados" do dashboard
 * (mesma listagem do Gerador de Links Shopee).
 *
 *   POST /api/shopee-trends/affiliate-link
 *   Body: { itemId: number, subIds?: string[] }     // até 3 sub_ids
 *   Resposta: { shortLink }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { shopeeGenerateShortLink } from "@/lib/shopee-affiliate-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const itemId = Number(body?.itemId);
    if (!Number.isFinite(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "itemId obrigatório" }, { status: 400 });
    }
    // Aceita `subIds` (novo, array de até 3) e `subId` (legado, string única).
    const rawSubIds: string[] = (() => {
      if (Array.isArray(body?.subIds)) {
        return (body.subIds as unknown[]).map((s) => String(s ?? "").trim()).filter(Boolean);
      }
      const single = typeof body?.subId === "string" ? body.subId.trim() : "";
      return single ? [single] : [];
    })();
    const subIdsInput: string[] = rawSubIds
      .map((s: string) => s.slice(0, 64))
      .slice(0, 3);

    // Credenciais Shopee do usuário.
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("shopee_app_id, shopee_api_key")
      .eq("id", user.id)
      .single();
    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
    const appId = (profile as { shopee_app_id?: string | null } | null)?.shopee_app_id?.trim();
    const secret = (profile as { shopee_api_key?: string | null } | null)?.shopee_api_key?.trim();
    if (!appId || !secret) {
      return NextResponse.json(
        { error: "Configure suas credenciais Shopee em Configurações antes de gerar o link." },
        { status: 400 },
      );
    }

    // Snapshot do produto — pega tudo que precisamos pra histórico em uma query.
    const { data: snap, error: snapErr } = await supabase
      .from("shopee_trend_snapshots")
      .select(
        "product_link, shop_id, product_name, image_url, price, price_min, price_max, commission_rate, viralization_score",
      )
      .eq("item_id", itemId)
      .maybeSingle();
    if (snapErr) return NextResponse.json({ error: snapErr.message }, { status: 500 });
    if (!snap) return NextResponse.json({ error: "Produto não está mais em alta" }, { status: 404 });

    const snapRow = snap as {
      product_link?: string | null;
      shop_id?: number | null;
      product_name?: string | null;
      image_url?: string | null;
      price?: number | string | null;
      price_min?: number | string | null;
      price_max?: number | string | null;
      commission_rate?: number | string | null;
      viralization_score?: number | null;
    };

    const productLink =
      snapRow.product_link?.trim() ||
      (snapRow.shop_id ? `https://shopee.com.br/product/${snapRow.shop_id}/${itemId}` : null);
    if (!productLink) {
      return NextResponse.json({ error: "Link do produto indisponível" }, { status: 502 });
    }

    const result = await shopeeGenerateShortLink(appId, secret, productLink, subIdsInput);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    const shortLink = result.shortLink;

    // Persiste no histórico — mesmas colunas que o Gerador de Links Shopee usa,
    // pra que a listagem "Links Gerados" mostre os dois fluxos juntos. Falha
    // silenciosa: se der erro, ainda devolvemos o shortLink (o usuário fez sua
    // parte; histórico é nice-to-have).
    const num = (v: unknown): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const price = num(snapRow.price ?? snapRow.price_min);
    const commissionRate = num(snapRow.commission_rate);
    const commissionValue = Math.round(price * commissionRate * 100) / 100;
    const { error: histErr } = await supabase.from("shopee_link_history").insert({
      user_id: user.id,
      short_link: shortLink,
      origin_url: productLink,
      sub_id_1: subIdsInput[0] ?? "",
      sub_id_2: subIdsInput[1] ?? "",
      sub_id_3: subIdsInput[2] ?? "",
      observation: "tendências",
      product_name: snapRow.product_name ?? "",
      slug: "",
      image_url: snapRow.image_url ?? "",
      commission_rate: commissionRate,
      commission_value: commissionValue,
      price_shopee: price > 0 ? price : null,
      price_shopee_original: num(snapRow.price_max) || null,
      price_shopee_discount_rate: null,
    });
    if (histErr) {
      console.warn("[shopee-trends/affiliate-link] persist history falhou:", histErr.message);
    }

    return NextResponse.json({ shortLink });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gerar link";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
