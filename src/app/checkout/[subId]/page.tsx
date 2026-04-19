"use client";

import { use, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Truck,
  Store,
  AlertTriangle,
  CreditCard,
  Package,
  Settings2,
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  AddressElement,
  LinkAuthenticationElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

type Produto = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number;
  priceOld: number | null;
  allowShipping: boolean;
  allowPickup: boolean;
  hasDimensions: boolean;
};

type InfoResponse = {
  produto: Produto;
  pickupAddress: string | null;
  publishableKey: string | null;
  theme?: {
    mode: "dark" | "light";
    headerImageUrl: string | null;
    footerImageUrl: string | null;
    footerImageSize?: "full" | "medium" | "small";
  };
};

type ThemePalette = {
  mode: "dark" | "light";
  bg: string;
  cardBg: string;
  cardBorder: string;
  inputBg: string;
  inputBorder: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  emerald: string;
};

const DARK_PALETTE: ThemePalette = {
  mode: "dark",
  bg: "#18181b",
  cardBg: "#27272a",
  cardBorder: "#2c2c32",
  inputBg: "#222228",
  inputBorder: "#3e3e46",
  text: "#f0f0f2",
  textMuted: "#c8c8ce",
  textFaint: "#9a9aa2",
  accent: "#635bff",
  emerald: "#34d399",
};

const LIGHT_PALETTE: ThemePalette = {
  mode: "light",
  bg: "#f5f5f7",
  cardBg: "#ffffff",
  cardBorder: "#e4e4e7",
  inputBg: "#f4f4f5",
  inputBorder: "#d4d4d8",
  text: "#18181b",
  textMuted: "#52525b",
  textFaint: "#71717a",
  accent: "#635bff",
  emerald: "#059669",
};

type ShippingOption = {
  id: number;
  name: string;
  price: number;
  deliveryTime: number | null;
  source: "superfrete" | "fallback";
};

type QuoteResponse = {
  options: ShippingOption[];
  fallback: boolean;
  fallbackReason?: string;
};

type Selection =
  | { type: "shipping"; option: ShippingOption }
  | { type: "pickup" }
  | null;

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function maskCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export default function CheckoutPage({ params }: { params: Promise<{ subId: string }> }) {
  const { subId: slug } = use(params);
  const [info, setInfo] = useState<InfoResponse | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState<string | null>(null);

  const [cep, setCep] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [options, setOptions] = useState<ShippingOption[] | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);

  const [selection, setSelection] = useState<Selection>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/checkout/${encodeURIComponent(slug)}/info`);
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(json?.error ?? "Produto não encontrado");
        setInfo(json as InfoResponse);
      } catch (e) {
        if (!alive) return;
        setInfoError(e instanceof Error ? e.message : "Erro");
      } finally {
        if (alive) setLoadingInfo(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  async function calcularFrete() {
    setQuoting(true);
    setQuoteError(null);
    setOptions(null);
    setIsFallback(false);
    try {
      const res = await fetch(`/api/checkout/${encodeURIComponent(slug)}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cepDestino: cep }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao cotar frete");
      const data = json as QuoteResponse;
      setOptions(data.options);
      setIsFallback(data.fallback);
      setFallbackReason(data.fallbackReason ?? null);
    } catch (e) {
      setQuoteError(e instanceof Error ? e.message : "Erro");
    } finally {
      setQuoting(false);
    }
  }

  if (loadingInfo) {
    return (
      <div className="min-h-screen bg-[#18181b] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#635bff]" />
      </div>
    );
  }

  if (infoError || !info) {
    return (
      <div className="min-h-screen bg-[#18181b] flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-red-300 mx-auto mb-3" />
          <p className="text-sm text-red-200">{infoError ?? "Produto não encontrado"}</p>
        </div>
      </div>
    );
  }

  const { produto, pickupAddress, publishableKey } = info;
  const palette: ThemePalette = info.theme?.mode === "light" ? LIGHT_PALETTE : DARK_PALETTE;
  const headerImageUrl = info.theme?.headerImageUrl ?? null;
  const footerImageUrl = info.theme?.footerImageUrl ?? null;
  const footerImageSize = info.theme?.footerImageSize ?? "full";

  // Fallback — vendedor ainda não configurou a Publishable Key da Stripe.
  if (!publishableKey) {
    return (
      <div className="min-h-screen bg-[#18181b] flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
          <Settings2 className="w-10 h-10 text-amber-300 mx-auto mb-3" />
          <h1 className="text-base font-bold text-amber-100">Checkout em manutenção</h1>
          <p className="mt-2 text-sm text-amber-200/90 leading-relaxed">
            O vendedor ainda não finalizou a configuração do pagamento.
            <br />
            Tente novamente em alguns minutos ou entre em contato diretamente com a loja.
          </p>
        </div>
      </div>
    );
  }

  const hasShippingFlow = produto.allowShipping;
  const hasPickupFlow = produto.allowPickup && pickupAddress;

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: palette.bg, color: palette.text }}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Banner customizado do afiliado (se configurado) */}
        {headerImageUrl ? (
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: palette.cardBorder }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={headerImageUrl} alt="" className="w-full h-auto object-cover" />
          </div>
        ) : null}

        {/* Produto */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: palette.cardBg, borderColor: palette.cardBorder }}
        >
          <div className="p-5 flex gap-4 items-start">
            {produto.imageUrl ? (
              <div
                className="w-24 h-24 rounded-lg overflow-hidden bg-white shrink-0 border"
                style={{ borderColor: palette.cardBorder }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={produto.imageUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div
                className="w-24 h-24 rounded-lg shrink-0 flex items-center justify-center border"
                style={{ background: palette.inputBg, borderColor: palette.cardBorder }}
              >
                <Package className="w-8 h-8" style={{ color: palette.textFaint }} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold leading-tight" style={{ color: palette.text }}>
                {produto.name}
              </h1>
              <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl font-bold tabular-nums" style={{ color: palette.emerald }}>
                  {formatBRL(produto.price)}
                </span>
                {produto.priceOld && produto.priceOld > produto.price ? (
                  <span className="text-sm line-through tabular-nums" style={{ color: palette.textFaint }}>
                    {formatBRL(produto.priceOld)}
                  </span>
                ) : null}
              </div>
              {produto.description ? (
                <p
                  className="mt-2 text-xs leading-relaxed whitespace-pre-wrap line-clamp-3"
                  style={{ color: palette.textMuted }}
                >
                  {produto.description}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Entrega */}
        <div
          className="rounded-xl border p-5 space-y-4"
          style={{ background: palette.cardBg, borderColor: palette.cardBorder }}
        >
          <h2
            className="text-sm font-bold uppercase tracking-wider"
            style={{ color: palette.textMuted }}
          >
            Entrega
          </h2>

          {hasShippingFlow ? (
            <div className="space-y-3">
              <label className="block text-[11px] font-semibold" style={{ color: palette.textMuted }}>
                Informe seu CEP
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={cep}
                  onChange={(e) => setCep(maskCep(e.target.value))}
                  placeholder="00000-000"
                  className="flex-1 rounded-xl px-3 py-2.5 text-[13px] border outline-none focus:border-[#635bff]"
                  style={{ background: palette.inputBg, borderColor: palette.inputBorder, color: palette.text }}
                />
                <button
                  type="button"
                  onClick={calcularFrete}
                  disabled={cep.replace(/\D/g, "").length !== 8 || quoting}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#635bff] text-white text-[12px] font-bold hover:bg-[#5048e5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {quoting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                  Calcular
                </button>
              </div>

              {quoteError ? (
                <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  {quoteError}
                </p>
              ) : null}

              {isFallback && options && options.length > 0 ? (
                <div className="text-[11px] text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                  <p>Cotação em tempo real indisponível — usando valor padrão do vendedor.</p>
                  {fallbackReason ? (
                    <p className="mt-1 text-[10px] text-amber-300/60 font-mono break-all">
                      debug: {fallbackReason}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {options && options.length > 0 ? (
                <div className="space-y-2 pt-1">
                  {options.map((opt, i) => {
                    const checked =
                      selection?.type === "shipping" &&
                      selection.option.id === opt.id &&
                      selection.option.name === opt.name;
                    return (
                      <label
                        key={`${opt.id}-${i}`}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors"
                        style={{
                          background: checked ? "#635bff1a" : palette.inputBg,
                          borderColor: checked ? palette.accent : palette.inputBorder,
                        }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="radio"
                            name="delivery"
                            checked={checked}
                            onChange={() => setSelection({ type: "shipping", option: opt })}
                            className="w-4 h-4 accent-[#635bff] shrink-0"
                          />
                          <Truck className="w-4 h-4 shrink-0" style={{ color: palette.accent }} />
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold truncate" style={{ color: palette.text }}>
                              {opt.name}
                            </p>
                            {opt.deliveryTime ? (
                              <p className="text-[10px]" style={{ color: palette.textFaint }}>
                                {opt.deliveryTime} dia{opt.deliveryTime === 1 ? "" : "s"} úteis
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <span
                          className="text-[13px] font-mono font-bold tabular-nums shrink-0"
                          style={{ color: palette.emerald }}
                        >
                          {formatBRL(opt.price)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {hasPickupFlow ? (
            <div className="pt-1">
              <label
                className="flex items-start gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-colors"
                style={{
                  background: selection?.type === "pickup" ? "#635bff1a" : palette.inputBg,
                  borderColor: selection?.type === "pickup" ? palette.accent : palette.inputBorder,
                }}
              >
                <input
                  type="radio"
                  name="delivery"
                  checked={selection?.type === "pickup"}
                  onChange={() => setSelection({ type: "pickup" })}
                  className="mt-0.5 w-4 h-4 accent-[#635bff] shrink-0"
                />
                <Store className="w-4 h-4 shrink-0 mt-0.5" style={{ color: palette.accent }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold" style={{ color: palette.text }}>
                      Retirar na loja
                    </p>
                    <span
                      className="text-[12px] font-mono font-bold"
                      style={{ color: palette.emerald }}
                    >
                      Grátis
                    </span>
                  </div>
                  <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: palette.textFaint }}>
                    {pickupAddress}
                  </p>
                </div>
              </label>
            </div>
          ) : null}
        </div>

        {/* Pagamento */}
        {selection ? (
          <PaymentSection
            slug={slug}
            produto={produto}
            selection={selection}
            publishableKey={publishableKey}
            palette={palette}
          />
        ) : (
          <div
            className="rounded-xl border p-5 text-center"
            style={{ background: palette.cardBg, borderColor: palette.cardBorder }}
          >
            <p className="text-[12px]" style={{ color: palette.textFaint }}>
              Escolha uma opção de entrega acima pra continuar pro pagamento.
            </p>
          </div>
        )}

        {/* Footer image customizada pelo afiliado (selos / garantia / propaganda extra).
            No mobile (sm:) sempre w-full; no desktop (md+) respeita o tamanho escolhido. */}
        {footerImageUrl ? (
          <div
            className={`mx-auto rounded-xl overflow-hidden border ${
              footerImageSize === "small"
                ? "md:max-w-[40%]"
                : footerImageSize === "medium"
                  ? "md:max-w-[65%]"
                  : ""
            }`}
            style={{ borderColor: palette.cardBorder }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={footerImageUrl} alt="" className="w-full h-auto object-cover" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Pagamento (Stripe Elements) ───────────────────────────────────────────────

function PaymentSection({
  slug,
  produto,
  selection,
  publishableKey,
  palette,
}: {
  slug: string;
  produto: Produto;
  selection: NonNullable<Selection>;
  publishableKey: string;
  palette: ThemePalette;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frete = selection.type === "shipping" ? selection.option.price : 0;
  const total = produto.price + frete;

  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);

  useEffect(() => {
    let alive = true;
    setClientSecret(null);
    setError(null);
    setCreating(true);
    (async () => {
      try {
        const payload =
          selection.type === "pickup"
            ? { mode: "pickup" }
            : {
                mode: "shipping",
                shippingPrice: selection.option.price,
                shippingName: selection.option.name,
              };
        const res = await fetch(`/api/checkout/${encodeURIComponent(slug)}/payment-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(json?.error ?? "Erro ao iniciar pagamento");
        setClientSecret(json.clientSecret as string);
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
  }, [slug, selection]);

  if (creating) {
    return (
      <div
        className="rounded-xl border p-8 flex items-center justify-center"
        style={{ background: palette.cardBg, borderColor: palette.cardBorder }}
      >
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

  if (!clientSecret) return null;

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: palette.mode === "light" ? "stripe" : "night",
          variables: {
            colorPrimary: palette.accent,
            colorBackground: palette.inputBg,
            colorText: palette.text,
            colorDanger: "#ef4444",
            fontFamily: "Inter, system-ui, sans-serif",
            borderRadius: "10px",
          },
        },
        loader: "auto",
      }}
    >
      <CheckoutForm
        total={total}
        productPrice={produto.price}
        frete={frete}
        showShippingAddress={selection.type === "shipping"}
        slug={slug}
        palette={palette}
      />
    </Elements>
  );
}

function CheckoutForm({
  total,
  productPrice,
  frete,
  showShippingAddress,
  slug: slugForReturn,
  palette,
}: {
  total: number;
  productPrice: number;
  frete: number;
  showShippingAddress: boolean;
  slug: string;
  palette: ThemePalette;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setErr(null);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/sucesso?slug=${encodeURIComponent(slugForReturn)}`,
      },
    });
    if (error) {
      setErr(error.message ?? "Erro no pagamento");
      setSubmitting(false);
    }
  }

  const cardStyle = { background: palette.cardBg, borderColor: palette.cardBorder };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border p-5 space-y-4" style={cardStyle}>
        <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: palette.textMuted }}>
          Seus dados
        </h2>
        <LinkAuthenticationElement options={{ defaultValues: { email: "" } }} />
        {showShippingAddress ? (
          <AddressElement
            options={{
              mode: "shipping",
              allowedCountries: ["BR"],
              fields: { phone: "always" },
              validation: { phone: { required: "always" } },
            }}
          />
        ) : null}
      </div>

      <div className="rounded-xl border p-5 space-y-3" style={cardStyle}>
        <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: palette.textMuted }}>
          Pagamento
        </h2>
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      <div className="rounded-xl border p-5 space-y-3" style={cardStyle}>
        <div
          className="flex items-center justify-between text-[12px]"
          style={{ color: palette.textMuted }}
        >
          <span>Produto</span>
          <span className="font-mono tabular-nums">{formatBRL(productPrice)}</span>
        </div>
        <div
          className="flex items-center justify-between text-[12px]"
          style={{ color: palette.textMuted }}
        >
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

        {err ? (
          <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</p>
        ) : null}

        <button
          type="submit"
          disabled={!stripe || !elements || submitting}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-[14px] font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          style={{ background: palette.accent }}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          {submitting ? "Processando..." : `Pagar ${formatBRL(total)}`}
        </button>
        <p className="text-[10px] text-center" style={{ color: palette.textFaint }}>
          Pagamento processado pela Stripe. Seus dados de cartão não passam pelo nosso servidor.
        </p>
      </div>
    </form>
  );
}

