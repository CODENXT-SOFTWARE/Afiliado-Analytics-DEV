/**
 * Cron: dispara ofertas para configs ativas com janela válida (início/fim obrigatórios, máx. 14 h).
 * Ignora configs sem janela ou com janela inválida (economia de backend).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "utils/supabase/server";
import crypto from "crypto";
import { mensagemErroJanela } from "@/lib/grupos-venda-janela";
import {
  buildListaOfferWebhookPayload,
  buildInfoprodutorWebhookPayload,
  GRUPOS_VENDA_WEBHOOK_DEFAULT,
  resolveGruposVendaListaWebhookUrl,
} from "@/lib/grupos-venda-webhook";
import { effectiveListaOfferPromoPrice } from "@/lib/lista-ofertas-effective-promo";
import { interleaveCrossover } from "@/lib/grupos-venda-crossover";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

/** Verifica se o horário atual em Brasília (UTC-3, sem DST desde 2019) está dentro da janela configurada. */
function isWithinBrasiliaWindow(horarioInicio: string | null, horarioFim: string | null): boolean {
  if (!horarioInicio || !horarioFim) return true;

  const now = new Date();
  const brasiliaMinutes = ((now.getUTCHours() * 60 + now.getUTCMinutes()) - 180 + 1440) % 1440;

  const [startH, startM] = horarioInicio.split(":").map(Number);
  const [endH, endM] = horarioFim.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return brasiliaMinutes >= startMinutes && brasiliaMinutes <= endMinutes;
  }
  // janela que atravessa meia-noite (ex: 22:00 → 06:00)
  return brasiliaMinutes >= startMinutes || brasiliaMinutes <= endMinutes;
}

const SHOPEE_GQL = "https://open-api.affiliate.shopee.com.br/graphql";

function buildShopeeAuth(appId: string, secret: string, payload: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureRaw = `${appId}${timestamp}${payload}${secret}`;
  const signature = crypto.createHash("sha256").update(signatureRaw).digest("hex");
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

type CronResultBody =
  | { ok: true; processed: 0; message: string }
  | { ok: true; processed: number; results: { userId: string; keyword?: string; ok: boolean; error?: string }[] };

type CronRunOptions = {
  /** POST do painel: só processa automações deste usuário. */
  manualUserId?: string | null;
  /** Teste manual: dispara mesmo fora da janela de horário. */
  skipWindowCheck?: boolean;
  /** Teste de um card (ativa ou pausada); avança `proximo_indice` / pool como um tick real. */
  singleConfigId?: string | null;
};

/** Lógica compartilhada: Vercel Cron (GET + Bearer) ou teste no app (POST + sessão). */
async function runCronDisparo(opts?: CronRunOptions): Promise<CronResultBody> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const sel = "id, user_id, instance_id, lista_id, lista_ofertas_id, lista_ofertas_ml_id, lista_ofertas_info_id, keywords, sub_id_1, sub_id_2, sub_id_3, proximo_indice, keyword_pool_indices, horario_inicio, horario_fim";

  let configQuery = supabase.from("grupos_venda_continuo").select(sel);
  if (opts?.singleConfigId && opts.manualUserId) {
    configQuery = configQuery.eq("id", opts.singleConfigId).eq("user_id", opts.manualUserId);
  } else {
    configQuery = configQuery.eq("ativo", true);
    if (opts?.manualUserId) configQuery = configQuery.eq("user_id", opts.manualUserId);
  }

  const { data: configs, error: configError } = await configQuery;

  if (configError) {
    return { ok: true, processed: 0, message: configError.message };
  }
  if (!configs?.length) {
    if (opts?.singleConfigId) {
      return { ok: true, processed: 0, message: "Automação não encontrada ou sem permissão." };
    }
    return { ok: true, processed: 0, message: "Nenhum disparo ativo" };
  }

  const results: { userId: string; keyword?: string; ok: boolean; error?: string }[] = [];

  for (const cfg of configs) {
    const userId = cfg.user_id as string;
    const instanceId = cfg.instance_id as string;
    const listaId = (cfg as { lista_id?: string | null }).lista_id ?? null;
    const listaOfertasId = (cfg as { lista_ofertas_id?: string | null }).lista_ofertas_id ?? null;
    const listaOfertasMlId = (cfg as { lista_ofertas_ml_id?: string | null }).lista_ofertas_ml_id ?? null;
    const listaOfertasInfoId = (cfg as { lista_ofertas_info_id?: string | null }).lista_ofertas_info_id ?? null;
    const keywords = (cfg.keywords as string[]) ?? [];
    const proximoIndice = Number(cfg.proximo_indice) ?? 0;
    const subIds = [cfg.sub_id_1, cfg.sub_id_2, cfg.sub_id_3].filter(Boolean) as string[];
    const horarioInicio = (cfg as { horario_inicio?: string | null }).horario_inicio ?? null;
    const horarioFim = (cfg as { horario_fim?: string | null }).horario_fim ?? null;

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

    const isListaOfertasMode = !!listaOfertasId || !!listaOfertasMlId;
    const isListaInfoMode = !!listaOfertasInfoId;
    if (!isListaOfertasMode && !isListaInfoMode && keywords.length === 0) {
      results.push({ userId, ok: false, error: "Sem keywords" });
      continue;
    }

    try {
      const { data: instance } = await supabase.from("evolution_instances").select("nome_instancia, hash").eq("id", instanceId).single();
      const instanceName = (instance as { nome_instancia?: string } | null)?.nome_instancia ?? "";
      const hash = (instance as { hash?: string | null } | null)?.hash ?? "";

      const { data: groups } = listaId
        ? await supabase.from("grupos_venda").select("group_id").eq("lista_id", listaId)
        : await supabase.from("grupos_venda").select("group_id").eq("user_id", userId).eq("instance_id", instanceId);
      const groupIds = (groups ?? []).map((g: { group_id: string }) => g.group_id);
      if (groupIds.length === 0) {
        results.push({ userId, ok: false, error: "Nenhum grupo salvo" });
        continue;
      }

      if (isListaInfoMode) {
        type InfoRow = {
          product_name: string;
          description: string | null;
          image_url: string | null;
          link: string;
          price: number | string | null;
          price_old: number | string | null;
        };
        const { data: itensInfo } = await supabase
          .from("minha_lista_ofertas_info")
          .select("id, product_name, description, image_url, link, price, price_old")
          .eq("lista_id", listaOfertasInfoId)
          .eq("user_id", userId)
          .order("created_at", { ascending: true });
        const infoItems = (itensInfo ?? []) as InfoRow[];
        if (infoItems.length === 0) {
          results.push({ userId, ok: false, error: "Lista Infoprodutor vazia" });
          continue;
        }
        const idx = proximoIndice % infoItems.length;
        const nextIndex = (proximoIndice + 1) % infoItems.length;
        const item = infoItems[idx];
        const link = item.link?.trim() || "";
        if (!link) {
          results.push({ userId, ok: false, error: "Produto sem link" });
          await supabase.from("grupos_venda_continuo").update({ proximo_indice: nextIndex, updated_at: new Date().toISOString() }).eq("id", cfg.id);
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
        const payloadBody = buildInfoprodutorWebhookPayload({
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
        const whRes = await fetch(GRUPOS_VENDA_WEBHOOK_DEFAULT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadBody),
        });
        if (!whRes.ok) {
          results.push({ userId, ok: false, error: `Webhook ${whRes.status}` });
        } else {
          results.push({ userId, keyword: (item.product_name ?? "").slice(0, 30), ok: true });
        }
        await supabase
          .from("grupos_venda_continuo")
          .update({
            proximo_indice: nextIndex,
            ultimo_disparo_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", cfg.id);
        continue;
      }

      if (isListaOfertasMode) {
        type ListaRow = {
          product_name: string;
          image_url: string;
          price_original: number | null;
          price_promo: number | null;
          discount_rate: number | null;
          converter_link: string;
        };
        const shopeeItems: ListaRow[] = [];
        const mlItems: ListaRow[] = [];
        if (listaOfertasId) {
          const { data: itensS } = await supabase
            .from("minha_lista_ofertas")
            .select("id, product_name, image_url, price_original, price_promo, discount_rate, converter_link")
            .eq("lista_id", listaOfertasId)
            .eq("user_id", userId)
            .order("created_at", { ascending: true });
          shopeeItems.push(...((itensS ?? []) as ListaRow[]));
        }
        if (listaOfertasMlId) {
          const { data: itensM } = await supabase
            .from("minha_lista_ofertas_ml")
            .select("id, product_name, image_url, price_original, price_promo, discount_rate, converter_link")
            .eq("lista_id", listaOfertasMlId)
            .eq("user_id", userId)
            .order("created_at", { ascending: true });
          mlItems.push(...((itensM ?? []) as ListaRow[]));
        }
        // Crossover: alterna 1 Shopee, 1 ML, 1 Shopee, 1 ML… O `proximoIndice`
        // do `grupos_venda_continuo` percorre essa fila intercalada, então cada
        // tick de 10 min envia o próximo item — Shopee/ML/Shopee/ML — sem
        // precisar de outro estado.
        const items: ListaRow[] =
          shopeeItems.length > 0 && mlItems.length > 0
            ? interleaveCrossover(shopeeItems, mlItems)
            : [...shopeeItems, ...mlItems];
        if (items.length === 0) {
          results.push({ userId, ok: false, error: "Lista de ofertas vazia" });
          continue;
        }
        const idx = proximoIndice % items.length;
        const nextIndex = (proximoIndice + 1) % items.length;
        const item = items[idx];
        const linkAfiliado = item.converter_link?.trim() || "";
        if (!linkAfiliado) {
          results.push({ userId, ok: false, error: "Produto sem link" });
          await supabase.from("grupos_venda_continuo").update({ proximo_indice: nextIndex, updated_at: new Date().toISOString() }).eq("id", cfg.id);
          continue;
        }
        const nomeProduto = item.product_name ?? "";
        const rate = item.discount_rate ?? 0;
        const precoPorResolved =
          effectiveListaOfferPromoPrice(item.price_original, item.price_promo, item.discount_rate) ??
          item.price_promo ??
          0;
        const precoPor = precoPorResolved || 0;
        const precoRiscado = (item.price_original ?? precoPor) || 0;
        const payloadBody = buildListaOfferWebhookPayload({
          instanceName,
          hash,
          groupIds,
          nomeProduto,
          imageUrl: item.image_url ?? "",
          precoPor,
          precoRiscado,
          discountRate: rate,
          linkAfiliado,
        });

        const listaWebhookUrl = resolveGruposVendaListaWebhookUrl(!!listaOfertasId && !!listaOfertasMlId);
        const whRes = await fetch(listaWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadBody),
        });

        if (!whRes.ok) {
          results.push({ userId, ok: false, error: `Webhook ${whRes.status}` });
        } else {
          results.push({ userId, keyword: nomeProduto.slice(0, 30), ok: true });
        }
        await supabase
          .from("grupos_venda_continuo")
          .update({
            proximo_indice: nextIndex,
            ultimo_disparo_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", cfg.id);
        continue;
      }

      const keyword = keywords[proximoIndice % keywords.length];
      const nextIndex = (proximoIndice + 1) % keywords.length;

      const { data: profile } = await supabase.from("profiles").select("shopee_app_id, shopee_api_key").eq("id", userId).single();
      const appId = (profile as { shopee_app_id?: string } | null)?.shopee_app_id?.trim();
      const secret = (profile as { shopee_api_key?: string } | null)?.shopee_api_key?.trim();
      if (!appId || !secret) {
        results.push({ userId, keyword, ok: false, error: "Shopee não configurado" });
        await supabase.from("grupos_venda_continuo").update({ proximo_indice: nextIndex, ultimo_disparo_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", cfg.id);
        continue;
      }

      // Busca até 30 produtos pela keyword (listType 1 = ofertas), filtra promoção se houver; escolhe em ordem (índice persistido em keyword_pool_indices).
      const limit = 30;
      const queryProduct = `
        query {
          productOfferV2(keyword: "${keyword.replace(/"/g, '\\"')}", listType: 1, sortType: 2, page: 1, limit: ${limit}) {
            nodes {
              productName
              productLink
              offerLink
              imageUrl
              priceMin
              priceMax
              priceDiscountRate
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
      type ProductNode = { productLink?: string; offerLink?: string; productName?: string; imageUrl?: string; priceMin?: number; priceMax?: number; priceDiscountRate?: number };
      const emPromocao = (nodes as ProductNode[]).filter((n) => (n.priceDiscountRate ?? 0) > 0);
      const pool = emPromocao.length > 0 ? emPromocao : (nodes as ProductNode[]);
      const rawIndices = (cfg as { keyword_pool_indices?: unknown }).keyword_pool_indices;
      const keywordPoolIndices: Record<string, number> =
        rawIndices && typeof rawIndices === "object" && !Array.isArray(rawIndices)
          ? (rawIndices as Record<string, number>)
          : {};
      const n = Number.isFinite(keywordPoolIndices[keyword]) ? keywordPoolIndices[keyword]! : 0;
      const poolLen = pool.length;
      const pickIndex = poolLen > 0 ? n % poolLen : 0;
      const product = pool[pickIndex];
      if (!product) {
        results.push({ userId, keyword, ok: false, error: "Nenhum produto encontrado" });
        await supabase.from("grupos_venda_continuo").update({ proximo_indice: nextIndex, ultimo_disparo_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", cfg.id);
        continue;
      }
      const originUrl = product.productLink || product.offerLink || "";

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
        `💰 APROVEITE:${rate > 0 ? ` _${Math.round(rate)}% de DESCONTO!!!!_` : ""} \n🔴 De: ~${formatBRL(precoRiscado)}~ \n🔥 Por: *${formatBRL(precoPor)}* 😱\n` +
        `🏷️ PROMOÇÃO - CLIQUE NO LINK 👇\n` +
        linkAfiliado;
      const imagem = product.imageUrl ?? "";

      const whRes = await fetch(GRUPOS_VENDA_WEBHOOK_DEFAULT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });

      if (!whRes.ok) {
        results.push({ userId, keyword, ok: false, error: `Webhook ${whRes.status}` });
      } else {
        results.push({ userId, keyword, ok: true });
      }

      const nextKeywordPoolIndices = { ...keywordPoolIndices, [keyword]: n + 1 };
      await supabase
        .from("grupos_venda_continuo")
        .update({
          proximo_indice: nextIndex,
          ...(whRes.ok ? { keyword_pool_indices: nextKeywordPoolIndices } : {}),
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
 * Produção na Vercel: só aceita chamadas com Authorization: Bearer CRON_SECRET
 * (a Vercel injeta isso automaticamente quando CRON_SECRET está nas env vars do projeto).
 *
 * Sem CRON_SECRET, qualquer um pode fazer GET e disparar ofertas — por isso exigimos o segredo.
 */
export async function GET(req: NextRequest) {
  const onVercel = process.env.VERCEL === "1";
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();

  if (onVercel) {
    if (!cronSecret) {
      return NextResponse.json(
        {
          error:
            "CRON_SECRET não configurado na Vercel. Adicione em Settings → Environment Variables e faça redeploy. Sem isso o endpoint fica público e pode ser chamado por bots a qualquer intervalo.",
        },
        { status: 503 }
      );
    }
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await runCronDisparo();
  return NextResponse.json(body);
}

/** Teste manual no painel (Grupos de venda): exige usuário logado; não expõe CRON_SECRET no browser. */
export async function POST(req: NextRequest) {
  const supabaseAuth = await createServerClient();
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  const { data: { user } } = bearer
    ? await supabaseAuth.auth.getUser(bearer)
    : await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

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

  const body = await runCronDisparo({
    manualUserId: user.id,
    skipWindowCheck: true,
    singleConfigId: configId || null,
  });
  return NextResponse.json(body);
}
