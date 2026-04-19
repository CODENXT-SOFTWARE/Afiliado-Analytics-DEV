"use client";

import { useEffect, useState } from "react";
import { KeyRound, Trash2, ExternalLink, CheckCircle2, AlertTriangle, MessageCircle, Loader2 } from "lucide-react";
import Toolist from "@/app/components/ui/Toolist";

const STRIPE_DASHBOARD_URL = "https://dashboard.stripe.com/apikeys";

type StripeIntegrationCardProps = {
  initialHasKey?: boolean;
  initialLast4?: string | null;
  initialHasPublishableKey?: boolean;
  initialPublishableLast4?: string | null;
};

export default function StripeIntegrationCard({
  initialHasKey = false,
  initialLast4 = null,
  initialHasPublishableKey = false,
  initialPublishableLast4 = null,
}: StripeIntegrationCardProps) {
  const [secretKey, setSecretKey] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [hasKey, setHasKey] = useState(initialHasKey);
  const [last4, setLast4] = useState<string | null>(initialLast4);
  const [hasPk, setHasPk] = useState(initialHasPublishableKey);
  const [pkLast4, setPkLast4] = useState<string | null>(initialPublishableLast4);
  const [webhookActive, setWebhookActive] = useState<boolean | null>(null);
  const [webhookWarning, setWebhookWarning] = useState<string | null>(null);
  const [testingTipo, setTestingTipo] = useState<"vendedor" | "comprador" | null>(null);
  const [testFeedback, setTestFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Busca o status do webhook ao montar (e quando a chave muda)
  useEffect(() => {
    if (!hasKey) {
      setWebhookActive(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/settings/stripe");
        if (!res.ok) return;
        const j = await res.json();
        setWebhookActive(!!j?.webhook_active);
      } catch {
        /* ignore */
      }
    })();
  }, [hasKey, ok]);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setOk(false);
    setWebhookWarning(null);
    try {
      const res = await fetch("/api/settings/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stripe_secret_key: secretKey.trim(),
          stripe_publishable_key: publishableKey.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao salvar");
      setSecretKey("");
      setPublishableKey("");
      setHasKey(true);
      setLast4(json?.last4 ?? null);
      if (json?.publishable_last4) {
        setHasPk(true);
        setPkLast4(json.publishable_last4);
      }
      if (json?.webhook?.active) {
        setWebhookActive(true);
      } else if (json?.webhook?.reason) {
        setWebhookActive(false);
        setWebhookWarning(json.webhook.reason);
      }
      setOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async () => {
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/stripe", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao remover");
      setHasKey(false);
      setLast4(null);
      setSecretKey("");
      setPublishableKey("");
      setHasPk(false);
      setPkLast4(null);
      setConfirmRemove(false);
      setOk(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setRemoving(false);
    }
  };

  const onTestNotification = async (tipoAcao: "vendedor" | "comprador") => {
    setTestingTipo(tipoAcao);
    setTestFeedback(null);
    try {
      const res = await fetch("/api/infoprodutor/test-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipoAcao }),
      });
      const rawText = await res.text();
      let parsed: { ok?: boolean; error?: string } = {};
      try {
        parsed = rawText ? JSON.parse(rawText) : {};
      } catch {
        // Servidor devolveu HTML ou texto puro — provavelmente 500 não-capturado do Next.
        if (!res.ok) {
          throw new Error(`Servidor respondeu ${res.status}. Resposta: ${rawText.slice(0, 200)}`);
        }
      }
      if (!res.ok) throw new Error(parsed?.error ?? `Falha no teste (${res.status})`);
      setTestFeedback({
        ok: true,
        msg: `Payload enviado ao n8n com tipoAcao "${tipoAcao}". Confira no seu WhatsApp e no log do n8n.`,
      });
    } catch (e) {
      setTestFeedback({ ok: false, msg: e instanceof Error ? e.message : "Erro" });
    } finally {
      setTestingTipo(null);
    }
  };

  return (
    <section className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
      <div className="bg-dark-bg/40 border-b border-dark-border px-5 py-4">
        <h2 className="text-base sm:text-lg font-semibold text-text-primary font-heading">
          Stripe — API
        </h2>
        <p className="text-xs text-text-secondary mt-1">
          Conecte sua conta Stripe para criar produtos com checkout automático direto do Infoprodutor.
        </p>
      </div>

      <div className="px-5 py-5 space-y-4">
        {hasKey && !confirmRemove ? (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Desconectar Stripe
          </button>
        ) : null}

        {confirmRemove ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3">
            <p className="text-xs text-text-secondary flex-1 min-w-[200px]">
              Apagar a chave secreta da Stripe deste servidor? Produtos já criados na Stripe continuam funcionando.
            </p>
            <button
              type="button"
              onClick={() => setConfirmRemove(false)}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-dark-bg"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void onRemove()}
              disabled={removing}
              className="rounded-md px-3 py-1.5 text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-60"
            >
              {removing ? "Removendo…" : "Desconectar"}
            </button>
          </div>
        ) : null}

        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <KeyRound className="h-4 w-4 text-shopee-orange" />
            Chave secreta (Secret Key)
          </label>
          <input
            type="password"
            value={secretKey}
            onChange={(e) => {
              setSecretKey(e.target.value);
              setOk(false);
            }}
            placeholder={hasKey ? "Deixe em branco para manter a atual" : "sk_live_... ou sk_test_..."}
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary placeholder-text-secondary/60 focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange sm:text-sm"
          />
          {hasKey && last4 ? (
            <p className="text-[11px] text-text-secondary mt-1">
              Chave salva no servidor (termina em <span className="text-shopee-orange/90">…{last4}</span>).
            </p>
          ) : (
            <p className="text-[11px] text-text-secondary mt-1">
              Gere sua Secret Key no painel da Stripe:{" "}
              <a
                href={STRIPE_DASHBOARD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-shopee-orange hover:underline inline-flex items-center gap-1"
              >
                Stripe · API keys <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <KeyRound className="h-4 w-4 text-shopee-orange" />
            Publishable Key
            <Toolist
              variant="floating"
              wide
              text="Chave pública da Stripe (pk_live_... ou pk_test_...). Usada no checkout inline do comprador pra renderizar o formulário de cartão/PIX/boleto sem sair da sua página. Pega no mesmo painel da Secret Key."
            />
          </label>
          <input
            type="text"
            value={publishableKey}
            onChange={(e) => {
              setPublishableKey(e.target.value);
              setOk(false);
            }}
            placeholder={hasPk ? "Deixe em branco para manter a atual" : "pk_live_... ou pk_test_..."}
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary placeholder-text-secondary/60 focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange sm:text-sm"
          />
          {hasPk && pkLast4 ? (
            <p className="text-[11px] text-text-secondary mt-1">
              Publishable salva (termina em <span className="text-shopee-orange/90">…{pkLast4}</span>).
            </p>
          ) : (
            <p className="text-[11px] text-text-secondary mt-1">
              Obrigatória pro checkout inline (cartão / PIX / boleto no mesmo URL, sem redirect pro Stripe).
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || !secretKey.trim()}
            className="inline-flex items-center justify-center rounded-md px-5 py-2 text-sm font-semibold text-white bg-shopee-orange hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {saving ? "Validando…" : hasKey ? "Atualizar chave" : "Conectar Stripe"}
          </button>
          {ok && <span className="text-sm text-green-400">Chave validada e salva.</span>}
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>

        {/* Status do webhook de notificação */}
        {hasKey ? (
          <div
            className={`rounded-md border px-3 py-2.5 text-xs ${
              webhookActive
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/5 text-amber-300"
            }`}
          >
            <p className="font-semibold flex items-center gap-1.5">
              {webhookActive ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              <span>Notificação WhatsApp de venda:</span>
              <span className={webhookActive ? "text-emerald-400" : "text-amber-400"}>
                {webhookActive ? "ativa" : webhookActive === false ? "inativa" : "—"}
              </span>
              {webhookActive ? (
                <Toolist
                  variant="floating"
                  wide
                  text="Quando sair uma venda, você recebe uma mensagem no WhatsApp da loja com dados do pedido. Certifique-se de que o WhatsApp da loja (em Endereço do remetente, logo abaixo) está conectado em Integração WhatsApp com o mesmo número."
                />
              ) : null}
            </p>
            {!webhookActive ? (
              <p className="mt-1 text-text-secondary leading-relaxed">
                {webhookWarning
                  ? `Não foi possível registrar o webhook na Stripe: ${webhookWarning}`
                  : "Webhook ainda não registrado. Clique em Atualizar chave pra tentar criar automaticamente."}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Teste de payload pro n8n (simula o que a Stripe enviaria numa compra real) */}
        {hasKey ? (
          <div className="rounded-md border border-dark-border bg-dark-bg/40 px-3 py-3 space-y-2">
            <p className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
              Testar envio ao n8n
              <Toolist
                variant="floating"
                wide
                text='Simula o payload que a Stripe envia numa compra concluída. Escolha o tipo de notificação ("vendedor" ou "comprador") — o backend monta uma mensagem fake e dispara no STRIPE_WEBHOOK_NOTIFICACOES do .env. O destino é sempre o seu próprio WhatsApp da loja, pra você receber e conferir.'
              />
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => void onTestNotification("vendedor")}
                disabled={testingTipo !== null}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60"
              >
                {testingTipo === "vendedor" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <MessageCircle className="h-3 w-3" />
                )}
                Testar VENDEDOR
              </button>
              <button
                type="button"
                onClick={() => void onTestNotification("comprador")}
                disabled={testingTipo !== null}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-sky-500/40 bg-sky-500/10 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 disabled:opacity-60"
              >
                {testingTipo === "comprador" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <MessageCircle className="h-3 w-3" />
                )}
                Testar COMPRADOR
              </button>
            </div>
            {testFeedback ? (
              <p className={`text-[11px] leading-relaxed ${testFeedback.ok ? "text-emerald-400" : "text-red-400"}`}>
                {testFeedback.ok ? "✓ " : "✕ "}
                {testFeedback.msg}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
