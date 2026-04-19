/**
 * Credenciais da Stripe por usuário.
 * Segue o padrão de /api/settings/mercadolivre-api (token em texto + last4 visível).
 * O POST valida a chave chamando Stripe antes de gravar — falha cedo se estiver errada.
 *
 * Ao salvar a chave, também cria (ou renova) o webhook da Stripe programaticamente
 * para receber `checkout.session.completed` e notificar o vendedor no WhatsApp.
 * O DELETE limpa esse webhook na Stripe também.
 */

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase-server";
import { ensureWebhookForUser, deleteWebhookSafely } from "@/lib/infoprod/stripe-webhook-setup";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("stripe_secret_key_last4, stripe_secret_key_updated_at, stripe_webhook_endpoint_id")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  return NextResponse.json({
    has_key: !!data?.stripe_secret_key_last4,
    last4: data?.stripe_secret_key_last4 ?? null,
    updated_at: data?.stripe_secret_key_updated_at ?? null,
    webhook_active: !!data?.stripe_webhook_endpoint_id,
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const secretKey = String(body?.stripe_secret_key ?? "").trim();

  if (!secretKey) {
    return NextResponse.json(
      { error: "Informe a chave secreta da Stripe (sk_live_... ou sk_test_...)." },
      { status: 400 },
    );
  }

  if (!/^sk_(live|test)_/.test(secretKey)) {
    return NextResponse.json(
      { error: "Chave inválida. A chave secreta da Stripe começa com sk_live_ ou sk_test_." },
      { status: 400 },
    );
  }

  // Valida a chave + captura o account_id (usado pra detectar produtos órfãos depois).
  let stripeAccountId = "";
  try {
    const stripe = new Stripe(secretKey);
    const account = await stripe.accounts.retrieve();
    stripeAccountId = account.id ?? "";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chave recusada pela Stripe";
    return NextResponse.json({ error: `Chave inválida: ${msg}` }, { status: 400 });
  }

  // Carrega o endpoint antigo (se houver) — se a chave mudou, o endpoint antigo está
  // atrelado à conta antiga e não deve ser reutilizado.
  const { data: prev } = await supabase
    .from("profiles")
    .select("stripe_secret_key, stripe_webhook_endpoint_id")
    .eq("id", user.id)
    .single();
  const oldKey = (prev as { stripe_secret_key?: string | null } | null)?.stripe_secret_key ?? "";
  const oldEndpointId = (prev as { stripe_webhook_endpoint_id?: string | null } | null)?.stripe_webhook_endpoint_id ?? null;
  const keyChanged = oldKey && oldKey !== secretKey;

  // Se a chave mudou, apaga o endpoint antigo na conta antiga
  if (keyChanged && oldEndpointId) {
    await deleteWebhookSafely(oldKey, oldEndpointId);
  }

  // Sempre (re)cria o webhook pra garantir que está ativo. Se a chave não mudou e
  // o endpoint já existe e está saudável, ensureWebhookForUser devolve o mesmo id
  // sem criar um novo — mas também sem secret (pois a Stripe não devolve).
  const wh = await ensureWebhookForUser({
    stripeKey: secretKey,
    userId: user.id,
    existingEndpointId: keyChanged ? null : oldEndpointId,
  });

  const update: Record<string, string | null> = {
    stripe_secret_key: secretKey,
    stripe_secret_key_last4: secretKey.slice(-4),
    stripe_secret_key_updated_at: new Date().toISOString(),
    stripe_account_id: stripeAccountId || null,
  };
  if (wh.ok) {
    update.stripe_webhook_endpoint_id = wh.endpointId;
    // Só sobrescreve o secret se o create retornou um novo — no reuso, mantém o que já está no banco.
    if (wh.secret) update.stripe_webhook_secret = wh.secret;
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  return NextResponse.json({
    ok: true,
    last4: secretKey.slice(-4),
    webhook: wh.ok
      ? { active: true, endpointId: wh.endpointId, reused: wh.reused }
      : { active: false, reason: wh.reason },
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Apaga o webhook na Stripe antes de limpar as credenciais locais (best-effort)
  const { data: prev } = await supabase
    .from("profiles")
    .select("stripe_secret_key, stripe_webhook_endpoint_id")
    .eq("id", user.id)
    .single();
  const oldKey = (prev as { stripe_secret_key?: string | null } | null)?.stripe_secret_key ?? "";
  const oldEndpointId = (prev as { stripe_webhook_endpoint_id?: string | null } | null)?.stripe_webhook_endpoint_id ?? null;
  if (oldKey && oldEndpointId) {
    await deleteWebhookSafely(oldKey, oldEndpointId);
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      stripe_secret_key: null,
      stripe_secret_key_last4: null,
      stripe_secret_key_updated_at: null,
      stripe_webhook_endpoint_id: null,
      stripe_webhook_secret: null,
      stripe_account_id: null,
    })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
