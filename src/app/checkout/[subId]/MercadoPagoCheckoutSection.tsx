/**
 * Seção de pagamento via Mercado Pago no checkout do comprador.
 *
 * Usa o Payment Brick do MP — UI completa cartão+pix+boleto numa caixa só.
 *
 * Fluxo:
 *   1) Quando o comprador escolhe modo de entrega + preenche dados (whatsapp,
 *      email), criamos uma Preference no MP via /api/checkout/[subId]/mp-preference.
 *   2) O Brick renderiza com `preferenceId` + amount calculado.
 *   3) Comprador escolhe método e clica pagar dentro do Brick.
 *   4) Brick chama `onSubmit({ formData })` — POSTamos pra
 *      /api/checkout/[subId]/mp-payment que cria o pagamento na API do MP.
 *   5) Conforme o status:
 *        - `approved` → redireciona para /checkout/sucesso.
 *        - `pending` + Pix → mostra QR Code inline (comprador paga depois).
 *        - `pending` + Boleto → abre o PDF em nova aba.
 *        - Outros → mensagem de status.
 */

"use client";

import { useEffect, useState } from "react";
import { Loader2, ShoppingCart, QrCode, Copy, Check, ExternalLink } from "lucide-react";
import {
  initMercadoPago,
  Payment as MpPaymentBrick,
} from "@mercadopago/sdk-react";

type Selection =
  | { type: "shipping"; option: { name: string; price: number } }
  | { type: "pickup" }
  | { type: "digital" }
  | { type: "local_delivery" };

export type MpCheckoutPalette = {
  mode: "dark" | "light";
  cardBg: string;
  cardBorder: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  emerald: string;
};

type Props = {
  publicKey: string;
  slug: string;
  total: number;
  productPrice: number;
  frete: number;
  selection: Selection;
  buyerName: string;
  buyerWhatsapp: string;
  buyerEmail: string;
  ready: boolean;
  palette: MpCheckoutPalette;
};

type PixState = {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
};

// Polling do PIX — após mostrar o QR, consultamos o status a cada 4s. Quando
// o banco confirmar (status="approved"), redirecionamos pra página de
// agradecimento. Para automaticamente após o limite (PIX da MP costuma expirar
// em 30min, mas o comprador pode ter fechado a página antes disso).
const PIX_POLL_INTERVAL_MS = 4000;
const PIX_POLL_TIMEOUT_MS = 30 * 60 * 1000;

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function MercadoPagoCheckoutSection({
  publicKey,
  slug,
  total,
  productPrice,
  frete,
  selection,
  buyerName,
  buyerWhatsapp,
  buyerEmail,
  ready,
  palette,
}: Props) {
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pix, setPix] = useState<PixState | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // SDK do MP só pode ser inicializado uma vez por publicKey. Re-init com a
  // mesma key é seguro (idempotente internamente).
  useEffect(() => {
    if (!publicKey) return;
    initMercadoPago(publicKey, { locale: "pt-BR" });
  }, [publicKey]);

  // Polling do PIX: após gerar o QR, consulta o status até ser aprovado.
  useEffect(() => {
    if (!pix?.paymentId) return;
    let alive = true;
    const startedAt = Date.now();
    const interval = setInterval(async () => {
      if (!alive) return;
      if (Date.now() - startedAt > PIX_POLL_TIMEOUT_MS) {
        clearInterval(interval);
        return;
      }
      try {
        const res = await fetch(
          `/api/checkout/${encodeURIComponent(slug)}/payment-status?id=${encodeURIComponent(pix.paymentId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const json = (await res.json()) as { status?: string };
        if (json.status === "approved") {
          clearInterval(interval);
          window.location.href = `/checkout/sucesso?slug=${encodeURIComponent(slug)}&payment_id=${encodeURIComponent(pix.paymentId)}`;
        }
      } catch {
        /* mantém polling */
      }
    }, PIX_POLL_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [pix?.paymentId, slug]);

  // Cria a Preference quando o comprador finaliza dados de entrega.
  useEffect(() => {
    if (!ready) {
      setPreferenceId(null);
      setError(null);
      return;
    }
    let alive = true;
    setPreferenceId(null);
    setError(null);
    setPix(null);
    setCreating(true);
    (async () => {
      try {
        const waE164 = `55${buyerWhatsapp.replace(/\D/g, "")}`;
        const buyerCommon = {
          buyerName: buyerName.trim(),
          buyerWhatsapp: waE164,
          buyerEmail: buyerEmail.trim(),
        };
        const payload =
          selection.type === "pickup"
            ? { mode: "pickup", ...buyerCommon }
            : selection.type === "digital"
              ? { mode: "digital", ...buyerCommon }
              : selection.type === "local_delivery"
                ? { mode: "local_delivery", ...buyerCommon }
                : {
                    mode: "shipping",
                    shippingPrice: selection.option.price,
                    shippingName: selection.option.name,
                    ...buyerCommon,
                  };
        const res = await fetch(`/api/checkout/${encodeURIComponent(slug)}/mp-preference`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(json?.error ?? "Erro ao iniciar pagamento");
        setPreferenceId(json.preferenceId as string);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Erro");
      } finally {
        if (alive) setCreating(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug, selection, ready, buyerName, buyerWhatsapp, buyerEmail]);

  const cardStyle = { background: palette.cardBg, borderColor: palette.cardBorder };

  if (!ready) return null;

  if (creating) {
    return (
      <div className="rounded-xl border p-5 flex items-center justify-center" style={cardStyle}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: palette.accent }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-[12px] text-red-300">{error}</p>
      </div>
    );
  }

  if (pix) {
    const dataUrl = pix.qrCodeBase64 ? `data:image/png;base64,${pix.qrCodeBase64}` : null;
    return (
      <div className="rounded-xl border p-5 space-y-4" style={cardStyle}>
        <div className="flex items-center gap-2">
          <QrCode className="w-5 h-5" style={{ color: palette.accent }} />
          <h2 className="text-sm font-bold" style={{ color: palette.text }}>
            Pague com Pix
          </h2>
        </div>
        {dataUrl ? (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dataUrl} alt="QR Code Pix" className="rounded-lg bg-white p-2 max-w-[260px]" />
          </div>
        ) : null}
        <div className="space-y-2">
          <p className="text-[11px]" style={{ color: palette.textMuted }}>
            Ou copie o código Pix:
          </p>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 text-[10px] break-all px-3 py-2 rounded-lg font-mono"
              style={{ background: palette.cardBorder, color: palette.text }}
            >
              {pix.qrCode}
            </code>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(pix.qrCode);
                  setCopiedPix(true);
                  setTimeout(() => setCopiedPix(false), 2000);
                } catch {
                  /* ignore */
                }
              }}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold"
              style={{ background: palette.accent, color: "#fff" }}
            >
              {copiedPix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedPix ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
        {pix.ticketUrl ? (
          <a
            href={pix.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold underline"
            style={{ color: palette.accent }}
          >
            Abrir comprovante <ExternalLink className="w-3 h-3" />
          </a>
        ) : null}
        <div className="flex items-center justify-center gap-2 text-[10px] text-center" style={{ color: palette.textFaint }}>
          <Loader2 className="w-3 h-3 animate-spin" style={{ color: palette.accent }} />
          <span>Aguardando confirmação do banco — esta página atualiza sozinha.</span>
        </div>
      </div>
    );
  }

  if (!preferenceId) return null;

  return (
    <div className="rounded-xl border p-5 space-y-4" style={cardStyle}>
      <div className="flex items-center gap-2">
        <ShoppingCart className="w-5 h-5" style={{ color: palette.accent }} />
        <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: palette.textMuted }}>
          Pagamento
        </h2>
      </div>

      <MpPaymentBrick
        initialization={{ amount: total, preferenceId }}
        customization={{
          paymentMethods: {
            creditCard: "all",
            debitCard: "all",
            ticket: "all",
            bankTransfer: "all",
            mercadoPago: "all",
          },
          visual: {
            style: { theme: palette.mode === "light" ? "default" : "dark" },
          },
        }}
        onSubmit={async ({ formData }) => {
          if (submitting) return;
          setSubmitting(true);
          setError(null);
          try {
            const waE164 = `55${buyerWhatsapp.replace(/\D/g, "")}`;
            const body = {
              formData,
              mode: selection.type,
              ...(selection.type === "shipping"
                ? { shippingPrice: selection.option.price, shippingName: selection.option.name }
                : {}),
              ...(buyerName ? { buyerName: buyerName.trim() } : {}),
              ...(buyerWhatsapp ? { buyerWhatsapp: waE164 } : {}),
              ...(buyerEmail ? { buyerEmail: buyerEmail.trim() } : {}),
            };
            const res = await fetch(`/api/checkout/${encodeURIComponent(slug)}/mp-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const json = (await res.json()) as {
              id?: string | number;
              status?: string;
              statusDetail?: string;
              qrCode?: string | null;
              qrCodeBase64?: string | null;
              ticketUrl?: string | null;
              boletoUrl?: string | null;
              error?: string;
            };
            if (!res.ok) throw new Error(json?.error ?? "Erro ao processar pagamento");

            if (json.status === "approved") {
              window.location.href = `/checkout/sucesso?slug=${encodeURIComponent(slug)}&payment_id=${encodeURIComponent(String(json.id))}`;
              return;
            }
            // PIX — mostra QR Code na UI + inicia polling até aprovação.
            if (json.qrCode && json.id != null) {
              setPix({
                paymentId: String(json.id),
                qrCode: json.qrCode,
                qrCodeBase64: json.qrCodeBase64 ?? null,
                ticketUrl: json.ticketUrl ?? null,
              });
              return;
            }
            // Boleto — abre PDF em nova aba
            if (json.boletoUrl) {
              window.open(json.boletoUrl, "_blank");
              window.location.href = `/checkout/sucesso?slug=${encodeURIComponent(slug)}&payment_id=${encodeURIComponent(String(json.id))}&status=${encodeURIComponent(json.status ?? "pending")}`;
              return;
            }
            // Outros (rejeitado / em revisão)
            const detail = json.statusDetail ? ` (${json.statusDetail})` : "";
            throw new Error(`Pagamento ${json.status ?? "não concluído"}${detail}.`);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Erro no pagamento");
          } finally {
            setSubmitting(false);
          }
        }}
        onError={(err) => {
          setError(err instanceof Error ? err.message : "Erro ao carregar formulário de pagamento.");
        }}
      />

      <div className="rounded-xl border p-3 space-y-2" style={cardStyle}>
        <div className="flex items-center justify-between text-[12px]" style={{ color: palette.textMuted }}>
          <span>Produto</span>
          <span className="font-mono tabular-nums">{formatBRL(productPrice)}</span>
        </div>
        <div className="flex items-center justify-between text-[12px]" style={{ color: palette.textMuted }}>
          <span>Entrega</span>
          <span className="font-mono tabular-nums">{frete > 0 ? formatBRL(frete) : "Grátis"}</span>
        </div>
        <div className="h-px" style={{ background: palette.cardBorder }} />
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-bold" style={{ color: palette.text }}>
            Total
          </span>
          <span
            className="text-[18px] font-mono font-bold tabular-nums"
            style={{ color: palette.emerald }}
          >
            {formatBRL(total)}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-center" style={{ color: palette.textFaint }}>
        Pagamento processado pelo Mercado Pago. Seus dados de cartão não passam pelo nosso servidor.
      </p>
    </div>
  );
}
