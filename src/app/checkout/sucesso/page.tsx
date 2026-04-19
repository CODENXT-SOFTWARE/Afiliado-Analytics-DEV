"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, MessageCircle, AlertTriangle, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#18181b] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#635bff]" />
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <CheckoutSuccessInner />
    </Suspense>
  );
}

type OrderInfo = {
  paid: boolean;
  status: string;
  amount: number;
  product: { name: string };
  delivery: { mode: string | null; name: string | null };
  buyer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  shippingAddress: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
  } | null;
  sellerWhatsapp: string | null;
  orderShort: string;
};

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function onlyDigits(s: string): string {
  return (s || "").replace(/\D/g, "");
}

function buildWhatsAppUrl(phone: string | null, message: string): string | null {
  if (!phone) return null;
  const digits = onlyDigits(phone);
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

function buildMessage(info: OrderInfo): string {
  const lines: string[] = [
    "Olá! Acabei de concluir uma compra:",
    "",
    `🛒 *Produto:* ${info.product.name}`,
    `💰 *Valor:* ${formatBRL(info.amount)}`,
    `🧾 *Pedido:* #${info.orderShort}`,
    "",
  ];
  if (info.buyer.name) lines.push(`👤 *Comprador:* ${info.buyer.name}`);
  if (info.buyer.email) lines.push(`📧 ${info.buyer.email}`);
  if (info.buyer.phone) lines.push(`📱 ${info.buyer.phone}`);

  if (info.delivery.name) {
    lines.push("", `🚚 *Entrega:* ${info.delivery.name}`);
  }
  if (info.shippingAddress && info.delivery.mode !== "pickup") {
    const addr = info.shippingAddress;
    const line = [addr.line1, addr.line2].filter(Boolean).join(" — ");
    const cityUf = [addr.city, addr.state].filter(Boolean).join("/");
    const cep = addr.postalCode ? `CEP ${addr.postalCode}` : "";
    const full = [line, cityUf, cep].filter(Boolean).join(" · ");
    if (full) lines.push(`📍 ${full}`);
  }

  lines.push("", "Pode confirmar o recebimento e me passar o próximo passo?");
  return lines.join("\n");
}

function CheckoutSuccessInner() {
  const params = useSearchParams();
  const slug = params?.get("slug") ?? "";
  const pi = params?.get("payment_intent") ?? "";
  const redirectStatus = params?.get("redirect_status") ?? "";

  const [info, setInfo] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !pi) {
      setError("Link inválido");
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/checkout/sucesso/info?slug=${encodeURIComponent(slug)}&pi=${encodeURIComponent(pi)}`,
        );
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(json?.error ?? "Erro ao buscar pedido");
        setInfo(json as OrderInfo);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Erro");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug, pi]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#18181b] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#635bff]" />
      </div>
    );
  }

  // PIX / Boleto: Stripe redireciona com redirect_status=processing antes do pagamento real
  if (redirectStatus === "processing" || (info && !info.paid)) {
    return (
      <div className="min-h-screen bg-[#18181b] text-[#f0f0f2] flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-xl border border-sky-500/30 bg-sky-500/5 p-8 text-center">
          <Clock className="w-12 h-12 text-sky-400 mx-auto mb-4" />
          <h1 className="text-lg font-bold">Aguardando pagamento</h1>
          <p className="mt-2 text-sm text-[#c8c8ce] leading-relaxed">
            Recebemos seu pedido. Assim que a Stripe confirmar o pagamento (PIX ou boleto), o vendedor
            entrará em contato via WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="min-h-screen bg-[#18181b] flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-red-300 mx-auto mb-3" />
          <p className="text-sm text-red-200">{error ?? "Pedido não encontrado"}</p>
        </div>
      </div>
    );
  }

  const whatsappUrl = buildWhatsAppUrl(info.sellerWhatsapp, buildMessage(info));

  return (
    <div className="min-h-screen bg-[#18181b] text-[#f0f0f2] flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
        <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold">Pagamento confirmado!</h1>
        <p className="mt-2 text-sm text-[#c8c8ce] leading-relaxed">
          Seu pedido foi recebido. Em breve o vendedor entrará em contato pelo WhatsApp com os detalhes do envio.
        </p>

        <div className="mt-5 rounded-lg bg-[#222228] border border-[#2c2c32] p-4 text-left space-y-1.5">
          <div className="flex justify-between text-[12px]">
            <span className="text-[#9a9aa2]">Produto</span>
            <span className="font-semibold truncate ml-2 max-w-[65%]" title={info.product.name}>
              {info.product.name}
            </span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-[#9a9aa2]">Valor</span>
            <span className="font-mono font-bold text-emerald-400 tabular-nums">{formatBRL(info.amount)}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-[#9a9aa2]">Pedido</span>
            <span className="font-mono">#{info.orderShort}</span>
          </div>
        </div>

        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-emerald-500 text-white text-[14px] font-bold hover:bg-emerald-600 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Falar com a loja
          </a>
        ) : (
          <p className="mt-5 text-[11px] text-[#7a7a80] italic">
            Vendedor ainda não cadastrou um WhatsApp de contato.
          </p>
        )}
      </div>
    </div>
  );
}
