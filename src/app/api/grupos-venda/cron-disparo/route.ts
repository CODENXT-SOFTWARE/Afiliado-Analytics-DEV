/**
 * Cron: roda a cada 2 minutos. Para cada usuário com disparo contínuo ativo,
 * busca 1 produto pela keyword atual, envia ao webhook e avança para a próxima keyword (em loop).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

const SHOPEE_GQL = "https://open-api.affiliate.shopee.com.br/graphql";
const WEBHOOK_URL = "https://n8n.iacodenxt.online/webhook/achadinhoN1";

function buildShopeeAuth(appId: string, secret: string, payload: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureRaw = `${appId}${timestamp}${payload}${secret}`;
  const signature = crypto.createHash("sha256").update(signatureRaw).digest("hex");
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

export async function GET(req: NextRequest) {
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (isProd && process.env.CRON_SECRET) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: configs, error: configError } = await supabase
    .from("grupos_venda_continuo")
    .select("id, user_id, instance_id, lista_id, keywords, sub_id_1, sub_id_2, sub_id_3, proximo_indice")
    .eq("ativo", true);

  if (configError || !configs?.length) {
    return NextResponse.json({ ok: true, processed: 0, message: "Nenhum disparo ativo" });
  }

  const results: { userId: string; keyword?: string; ok: boolean; error?: string }[] = [];

  for (const cfg of configs) {
    const userId = cfg.user_id as string;
    const instanceId = cfg.instance_id as string;
    const listaId = (cfg as { lista_id?: string | null }).lista_id ?? null;
    const keywords = (cfg.keywords as string[]) ?? [];
    const proximoIndice = Number(cfg.proximo_indice) ?? 0;
    const subIds = [cfg.sub_id_1, cfg.sub_id_2, cfg.sub_id_3].filter(Boolean) as string[];

    if (keywords.length === 0) {
      results.push({ userId, ok: false, error: "Sem keywords" });
      continue;
    }

    const keyword = keywords[proximoIndice % keywords.length];
    const nextIndex = (proximoIndice + 1) % keywords.length;

    try {
      const { data: profile } = await supabase.from("profiles").select("shopee_app_id, shopee_api_key").eq("id", userId).single();
      const appId = (profile as { shopee_app_id?: string } | null)?.shopee_app_id?.trim();
      const secret = (profile as { shopee_api_key?: string } | null)?.shopee_api_key?.trim();
      if (!appId || !secret) {
        results.push({ userId, keyword, ok: false, error: "Shopee não configurado" });
        await supabase.from("grupos_venda_continuo").update({ proximo_indice: nextIndex, ultimo_disparo_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", cfg.id);
        continue;
      }

      const { data: instance } = await supabase.from("evolution_instances").select("nome_instancia, hash").eq("id", instanceId).single();
      const instanceName = (instance as { nome_instancia?: string } | null)?.nome_instancia ?? "";
      const hash = (instance as { hash?: string | null } | null)?.hash ?? "";

      const { data: groups } = listaId
        ? await supabase.from("grupos_venda").select("group_id").eq("lista_id", listaId)
        : await supabase.from("grupos_venda").select("group_id").eq("user_id", userId).eq("instance_id", instanceId);
      const groupIds = (groups ?? []).map((g: { group_id: string }) => g.group_id);
      if (groupIds.length === 0) {
        results.push({ userId, keyword, ok: false, error: "Nenhum grupo salvo" });
        await supabase.from("grupos_venda_continuo").update({ proximo_indice: nextIndex, updated_at: new Date().toISOString() }).eq("id", cfg.id);
        continue;
      }

      const queryProduct = `
        query {
          productOfferV2(keyword: "${keyword.replace(/"/g, '\\"')}", listType: 1, sortType: 2, page: 1, limit: 1) {
            nodes {
              productName
              productLink
              offerLink
              imageUrl
              priceMin
              priceMax
            }
          }
        }
      `;
      const payloadProduct = JSON.stringify({ query: queryProduct });
      const resProduct = await fetch(SHOPEE_GQL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: buildShopeeAuth(appId, secret, payloadProduct) },
        body: payloadProduct,
      });
      const jsonProduct = (await resProduct.json()) as { data?: { productOfferV2?: { nodes?: unknown[] } }; errors?: { message?: string }[] };
      const nodes = jsonProduct?.data?.productOfferV2?.nodes ?? [];
      const product = nodes[0] as { productLink?: string; offerLink?: string; productName?: string; imageUrl?: string; priceMin?: number; priceMax?: number } | undefined;
      const originUrl = product?.productLink || product?.offerLink || "";

      if (!originUrl) {
        results.push({ userId, keyword, ok: false, error: "Nenhum produto encontrado" });
        await supabase.from("grupos_venda_continuo").update({ proximo_indice: nextIndex, ultimo_disparo_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", cfg.id);
        continue;
      }

      const subIdsJson = JSON.stringify(subIds);
      const mutationLink = `mutation { generateShortLink(input: { originUrl: ${JSON.stringify(originUrl)}, subIds: ${subIdsJson} }) { shortLink } }`;
      const payloadLink = JSON.stringify({ query: mutationLink });
      const resLink = await fetch(SHOPEE_GQL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: buildShopeeAuth(appId, secret, payloadLink) },
        body: payloadLink,
      });
      const jsonLink = (await resLink.json()) as { data?: { generateShortLink?: { shortLink?: string } }; errors?: { message?: string }[] };
      const linkAfiliado = jsonLink?.data?.generateShortLink?.shortLink ?? "";
      if (!linkAfiliado) {
        results.push({ userId, keyword, ok: false, error: "Falha ao gerar link" });
        await supabase.from("grupos_venda_continuo").update({ proximo_indice: nextIndex, updated_at: new Date().toISOString() }).eq("id", cfg.id);
        continue;
      }

      const valor = product.priceMin ?? product.priceMax ?? 0;
      const descricao = product.productName ?? "";
      const imagem = product.imageUrl ?? "";

      const whRes = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName, hash, groupIds, imagem, descricao, valor, linkAfiliado }),
      });

      if (!whRes.ok) {
        results.push({ userId, keyword, ok: false, error: `Webhook ${whRes.status}` });
      } else {
        results.push({ userId, keyword, ok: true });
      }

      await supabase
        .from("grupos_venda_continuo")
        .update({
          proximo_indice: nextIndex,
          ultimo_disparo_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", cfg.id);
    } catch (e) {
      results.push({ userId, keyword, ok: false, error: e instanceof Error ? e.message : "Erro" });
    }
  }

  return NextResponse.json({ ok: true, processed: configs.length, results });
}
