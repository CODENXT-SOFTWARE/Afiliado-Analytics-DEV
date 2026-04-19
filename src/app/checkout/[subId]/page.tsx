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
    <div className="min-h-screen bg-[#18181b] text-[#f0f0f2] px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Produto */}
        <div className="rounded-xl border border-[#2c2c32] bg-[#27272a] overflow-hidden">
          <div className="p-5 flex gap-4 items-start">
            {produto.imageUrl ? (
              <div className="w-24 h-24 rounded-lg overflow-hidden bg-white shrink-0 border border-[#2c2c32]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={produto.imageUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-lg bg-[#222228] shrink-0 flex items-center justify-center border border-[#2c2c32]">
                <Package className="w-8 h-8 text-[#6b6b72]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold leading-tight">{produto.name}</h1>
              <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl font-bold text-emerald-400 tabular-nums">
                  {formatBRL(produto.price)}
                </span>
                {produto.priceOld && produto.priceOld > produto.price ? (
                  <span className="text-sm text-[#868686] line-through tabular-nums">
                    {formatBRL(produto.priceOld)}
                  </span>
                ) : null}
              </div>
              {produto.description ? (
                <p className="mt-2 text-xs text-[#c8c8ce] leading-relaxed whitespace-pre-wrap line-clamp-3">
                  {produto.description}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Entrega */}
        <div className="rounded-xl border border-[#2c2c32] bg-[#27272a] p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#d8d8d8]">Entrega</h2>

          {hasShippingFlow ? (
            <div className="space-y-3">
              <label className="block text-[11px] font-semibold text-[#d8d8d8]">
                Informe seu CEP
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={cep}
                  onChange={(e) => setCep(maskCep(e.target.value))}
                  placeholder="00000-000"
                  className="flex-1 bg-[#222228] border border-[#3e3e46] rounded-xl px-3 py-2.5 text-[13px] text-[#f0f0f2] placeholder:text-[#686868] focus:border-[#635bff] outline-none"
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
                <p className="text-[11px] text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                  Cotação em tempo real indisponível — usando valor padrão do vendedor.
                </p>
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
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                          checked
                            ? "border-[#635bff] bg-[#635bff]/10"
                            : "border-[#3e3e46] bg-[#222228] hover:border-[#635bff]/50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="radio"
                            name="delivery"
                            checked={checked}
                            onChange={() => setSelection({ type: "shipping", option: opt })}
                            className="w-4 h-4 accent-[#635bff] shrink-0"
                          />
                          <Truck className="w-4 h-4 text-[#a8a2ff] shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold truncate">{opt.name}</p>
                            {opt.deliveryTime ? (
                              <p className="text-[10px] text-[#9a9aa2]">
                                {opt.deliveryTime} dia{opt.deliveryTime === 1 ? "" : "s"} úteis
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <span className="text-[13px] font-mono font-bold text-emerald-400 tabular-nums shrink-0">
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
                className={`flex items-start gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-colors ${
                  selection?.type === "pickup"
                    ? "border-[#635bff] bg-[#635bff]/10"
                    : "border-[#3e3e46] bg-[#222228] hover:border-[#635bff]/50"
                }`}
              >
                <input
                  type="radio"
                  name="delivery"
                  checked={selection?.type === "pickup"}
                  onChange={() => setSelection({ type: "pickup" })}
                  className="mt-0.5 w-4 h-4 accent-[#635bff] shrink-0"
                />
                <Store className="w-4 h-4 text-[#a8a2ff] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold">Retirar na loja</p>
                    <span className="text-[12px] font-mono font-bold text-emerald-400">Grátis</span>
                  </div>
                  <p className="text-[11px] text-[#9a9aa2] mt-0.5 leading-relaxed">
                    {pickupAddress}
                  </p>
                </div>
              </label>
            </div>
          ) : null}
        </div>

        {/* Pagamento */}
        {selection ? (
          <PaymentSection slug={slug} produto={produto} selection={selection} publishableKey={publishableKey} />
        ) : (
          <div className="rounded-xl border border-[#2c2c32] bg-[#27272a] p-5 text-center">
            <p className="text-[12px] text-[#9a9aa2]">Escolha uma opção de entrega acima pra continuar pro pagamento.</p>
          </div>
        )}
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
}: {
  slug: string;
  produto: Produto;
  selection: NonNullable<Selection>;
  publishableKey: string;
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
      <div className="rounded-xl border border-[#2c2c32] bg-[#27272a] p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#635bff]" />
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
          theme: "night",
          variables: {
            colorPrimary: "#635bff",
            colorBackground: "#222228",
            colorText: "#f0f0f2",
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
}: {
  total: number;
  productPrice: number;
  frete: number;
  showShippingAddress: boolean;
  slug: string;
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-[#2c2c32] bg-[#27272a] p-5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#d8d8d8]">Seus dados</h2>
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

      <div className="rounded-xl border border-[#2c2c32] bg-[#27272a] p-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#d8d8d8]">Pagamento</h2>
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      <div className="rounded-xl border border-[#2c2c32] bg-[#27272a] p-5 space-y-3">
        <div className="flex items-center justify-between text-[12px] text-[#c8c8ce]">
          <span>Produto</span>
          <span className="font-mono tabular-nums">{formatBRL(productPrice)}</span>
        </div>
        <div className="flex items-center justify-between text-[12px] text-[#c8c8ce]">
          <span>Entrega</span>
          <span className="font-mono tabular-nums">{frete > 0 ? formatBRL(frete) : "Grátis"}</span>
        </div>
        <div className="h-px bg-[#2c2c32]" />
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-bold">Total</span>
          <span className="text-[18px] font-mono font-bold tabular-nums text-emerald-400">{formatBRL(total)}</span>
        </div>

        {err ? (
          <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</p>
        ) : null}

        <button
          type="submit"
          disabled={!stripe || !elements || submitting}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#635bff] text-white text-[14px] font-bold hover:bg-[#5048e5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          {submitting ? "Processando..." : `Pagar ${formatBRL(total)}`}
        </button>
        <p className="text-[10px] text-[#7a7a80] text-center">
          Pagamento processado pela Stripe. Seus dados de cartão não passam pelo nosso servidor.
        </p>
      </div>
    </form>
  );
}

