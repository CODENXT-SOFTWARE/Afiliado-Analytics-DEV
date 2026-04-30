/**
 * Webhook do Mercado Pago.
 *
 * Multi-tenant: como existe APENAS UMA URL de webhook por aplicação no painel
 * do MP, identificamos o vendedor pelo query param `?user_id={uuid}` que
 * incluímos na `notification_url` quando criamos a Preference. Pra eventos sem
 * esse param (recebidos pela URL global do painel), respondemos 200 ignorando.
 *
 *   POST /api/webhooks/mercadopago?user_id={uuid}
 *
 * Headers usados:
 *   - x-signature   : "ts=...,v1=..." (HMAC SHA256)
 *   - x-request-id  : id único do request
 *
 * Fluxo:
 *   1) Valida HMAC com MERCADO_PAGO_WEBHOOK_SECRET (chave do APP, não do vendedor).
 *   2) Resolve o vendedor pelo `user_id` da query.
 *   3) Se topic = "payment": busca o payment via API com o access_token do vendedor.
 *   4) Se status = "approved": resolve o produto via `external_reference`
 *      (formato: "infoprod:{produto_id}") e dispara `notifyPurchase` via n8n.
 *
 * Sempre responde 200 ao MP — mesmo em falhas de notificação — pra evitar
 * retries infinitos. Erros internos viram log.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifyMpWebhookSignature } from "@/lib/mercadopago/verify-webhook";
import { getMpPayment, type MpPayment } from "@/lib/mercadopago/api";
import { notifyPurchase } from "@/lib/infoprod/send-whatsapp-seller";
import { sendPushToUser } from "@/lib/push/web-push";
import { payloadNovaVendaInfoprodutor } from "@/lib/push/payloads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key);
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function parseExternalReference(ref: string | null | undefined): { kind: "infoprod"; produtoId: string } | null {
  if (!ref) return null;
  const m = /^infoprod:([0-9a-f-]{36})$/i.exec(ref.trim());
  if (!m) return null;
  return { kind: "infoprod", produtoId: m[1] };
}

type WebhookBody = {
  type?: string;
  topic?: string;
  action?: string;
  data?: { id?: string | number };
  resource?: string; // formato antigo: "https://api.../v1/payments/{id}"
};

function extractTopicAndDataId(body: WebhookBody, url: URL): { topic: string; dataId: string } {
  const topic = String(body.type || body.topic || url.searchParams.get("type") || url.searchParams.get("topic") || "")
    .toLowerCase()
    .trim();
  let dataId = "";
  const fromBody = body.data?.id;
  if (fromBody != null) dataId = String(fromBody).trim();
  if (!dataId) dataId = url.searchParams.get("data.id")?.trim() ?? "";
  if (!dataId && body.resource) {
    const m = /\/(payments|merchant_orders)\/(\d+)/i.exec(body.resource);
    if (m) dataId = m[2];
  }
  return { topic, dataId };
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id")?.trim() ?? "";

  // Lê body cru (precisa pra validação) e tenta JSON. MP às vezes manda body vazio
  // com tudo na query.
  const rawBody = await req.text();
  let body: WebhookBody = {};
  if (rawBody) {
    try {
      body = JSON.parse(rawBody) as WebhookBody;
    } catch {
      body = {};
    }
  }

  const { topic, dataId } = extractTopicAndDataId(body, url);
  if (!dataId) {
    return NextResponse.json({ received: true, skipped: "no data.id" });
  }

  // Validação de assinatura (a chave é a do APP, não do vendedor).
  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim() ?? "";
  if (webhookSecret) {
    const sigValid = verifyMpWebhookSignature({
      dataId,
      requestId: req.headers.get("x-request-id") ?? "",
      signature: req.headers.get("x-signature"),
      secret: webhookSecret,
    });
    if (!sigValid) {
      console.warn("[mp-webhook] assinatura inválida", { topic, dataId, userId });
      return new NextResponse("Invalid signature", { status: 400 });
    }
  } else {
    console.warn("[mp-webhook] MERCADO_PAGO_WEBHOOK_SECRET não configurado — pulando validação de assinatura");
  }

  // Sem user_id na query, não conseguimos resolver o vendedor → ignora silenciosamente.
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ received: true, skipped: "no user_id in query" });
  }

  // Por hora só processamos eventos de payment.
  if (!topic.startsWith("payment")) {
    return NextResponse.json({ received: true, skipped: `topic ${topic || "(empty)"}` });
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { received: true, error: "Supabase service role não configurado" },
      { status: 500 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("mp_access_token, mp_user_id")
    .eq("id", userId)
    .single();

  const accessToken =
    (profile as { mp_access_token?: string | null } | null)?.mp_access_token?.trim() ?? "";
  if (!accessToken) {
    console.warn("[mp-webhook] vendedor sem access_token MP", { userId });
    return NextResponse.json({ received: true, skipped: "seller has no MP token" });
  }

  // Busca o payment.
  let payment: MpPayment;
  try {
    payment = await getMpPayment(dataId, accessToken);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[mp-webhook] falha ao buscar payment", { dataId, userId, msg });
    return NextResponse.json({ received: true, error: msg });
  }

  // Só notifica em pagamentos aprovados.
  if (payment.status !== "approved") {
    return NextResponse.json({ received: true, skipped: `status ${payment.status}` });
  }

  // Resolve o produto pelo external_reference.
  const ref = parseExternalReference(payment.external_reference);
  if (!ref) {
    return NextResponse.json({ received: true, skipped: "external_reference não-Infoprodutor" });
  }

  const { data: produto } = await supabase
    .from("produtos_infoprodutor")
    .select("id, name, thank_you_message")
    .eq("user_id", userId)
    .eq("id", ref.produtoId)
    .maybeSingle();

  type ProdutoRow = { id: string; name: string; thank_you_message: string | null };
  const produtoRow = (produto as ProdutoRow | null) ?? null;
  if (!produtoRow) {
    return NextResponse.json({ received: true, skipped: "produto não encontrado" });
  }

  // Monta as mensagens.
  const buyerName = [
    payment.payer?.first_name ?? payment.additional_info?.payer?.first_name ?? "",
    payment.payer?.last_name ?? payment.additional_info?.payer?.last_name ?? "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim() || "—";
  const buyerEmail = payment.payer?.email ?? "—";
  const buyerPhone = (() => {
    const phone = payment.payer?.phone ?? payment.additional_info?.payer?.phone;
    if (!phone) return "";
    const area = phone.area_code ?? "";
    const num = phone.number ?? "";
    return `${area}${num}`.replace(/\D/g, "");
  })();

  const amount = formatBRL(typeof payment.transaction_amount === "number" ? payment.transaction_amount : 0);
  const orderShort = String(payment.id).slice(-10).toUpperCase();

  const sellerLines = [
    "🎉 *Nova venda!*",
    "",
    `🛒 *Produto:* ${produtoRow.name}`,
    `💰 *Valor:* ${amount}`,
    "",
    `👤 *Comprador:* ${buyerName}`,
    `📧 ${buyerEmail}`,
  ];
  if (buyerPhone) sellerLines.push(`📱 ${buyerPhone}`);
  sellerLines.push("", `🧾 Pedido #${orderShort}`);
  const sellerMessage = sellerLines.join("\n");

  const buyerBase =
    produtoRow.thank_you_message?.trim()
      || `Olá ${buyerName !== "—" ? buyerName : ""}! 🎉\n\nObrigado pela compra de *${produtoRow.name}*! Seu pagamento foi aprovado com sucesso.`;
  const buyerMessage = `${buyerBase}\n\n—\n🧾 Pedido #${orderShort}`;

  // Notificação Web Push pro vendedor (se ele tem subscription registrada).
  // Não bloqueia a resposta nem influencia o status pro Mercado Pago.
  const valor = typeof payment.transaction_amount === "number" ? payment.transaction_amount : 0;
  sendPushToUser(userId, payloadNovaVendaInfoprodutor(valor)).catch((err) => {
    console.error("[mp-webhook] push de nova venda falhou:", err);
  });

  try {
    const result = await notifyPurchase({
      userId,
      sellerMessage,
      buyerMessage,
      buyerPhone: buyerPhone || null,
    });
    if (!result.seller.ok) {
      console.error("[mp-webhook] notificação vendedor falhou:", result.seller.reason, {
        userId,
        paymentId: payment.id,
      });
    }
    if (result.buyer && !result.buyer.ok) {
      console.error("[mp-webhook] notificação comprador falhou:", result.buyer.reason, {
        userId,
        paymentId: payment.id,
      });
    }
    return NextResponse.json({
      received: true,
      seller: result.seller.ok,
      buyer: result.buyer ? result.buyer.ok : "skipped",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[mp-webhook] erro ao notificar:", msg);
    return NextResponse.json({ received: true, error: msg });
  }
}

// MP às vezes manda eventos via GET (formato antigo). Aceitamos pra não derrubar.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dataId = url.searchParams.get("data.id") || url.searchParams.get("id") || "";
  const topic = url.searchParams.get("topic") || url.searchParams.get("type") || "";
  return NextResponse.json({ received: true, mode: "GET", topic, dataId });
}
