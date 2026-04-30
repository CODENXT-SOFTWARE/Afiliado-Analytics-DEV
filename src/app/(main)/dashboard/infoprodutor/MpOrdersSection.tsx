"use client";

/**
 * Lista pedidos Mercado Pago do vendedor — visão enxuta. Não inclui modal de
 * impressão/etiqueta nem multi-select por enquanto: o foco dessa primeira
 * iteração é dar visibilidade aos pagamentos. Funcionalidades extras virão
 * se você pedir.
 *
 * Consome: GET /api/infoprodutor/mp-payments?period=...&produtoId=...
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Package,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Image as ImageIcon,
  CreditCard,
  ExternalLink,
  Search,
  MessageCircle,
  Mail,
} from "lucide-react";
import { readInfoprodCache, writeInfoprodCache, clearInfoprodCache } from "@/lib/infoprod/cache";

type Period = "7d" | "30d" | "90d" | "all";

type DeliveryType = "shipping" | "pickup" | "digital" | "local_delivery" | "unknown";

type Order = {
  paymentId: string;
  createdAt: string | null;
  approvedAt: string | null;
  amount: number;
  currency: string;
  status: string;
  statusDetail: string | null;
  produto: { id: string; name: string; imageUrl: string | null } | null;
  delivery: { type: DeliveryType; name: string | null };
  customer: { name: string | null; email: string | null; phone: string | null };
  shippingAddress: {
    line1: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
  } | null;
};

type OrdersResponse = {
  period: Period;
  payments: Order[];
  fetchedAt: string;
};

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "all", label: "Tudo" },
];

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  approved: { label: "Aprovado", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  pending: { label: "Pendente", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  in_process: { label: "Em revisão", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  authorized: { label: "Autorizado", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  rejected: { label: "Recusado", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  cancelled: { label: "Cancelado", cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30" },
  refunded: { label: "Reembolsado", cls: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30" },
  charged_back: { label: "Estornado", cls: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30" },
};

const DELIVERY_LABEL: Record<DeliveryType, string> = {
  shipping: "Envio (Correios)",
  pickup: "Retirada",
  digital: "Digital",
  local_delivery: "Entrega em casa",
  unknown: "—",
};

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const ms = Date.now() - t;
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return "agora mesmo";
  const min = Math.round(sec / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `há ${d}d`;
  return new Date(t).toLocaleDateString("pt-BR");
}

// Cache namespace dedicado pros pedidos MP (shape `payments[]`, evita colisão
// com cache de outro provider que pudesse ter `orders[]`).
const CACHE_SECTION = "mp-orders";

/** Recebe `7999062401` (DDD+número, sem 55) ou `5579999062401` (E.164) e
 * devolve um link wa.me. Quando o número não tiver formato reconhecível,
 * retorna null pra UI mostrar como texto plain. */
function buildWhatsAppLink(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Se já vem com 55 na frente (E.164), usa direto; senão, prepend.
  const e164 = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return `https://wa.me/${e164}`;
}

function formatWhatsAppDisplay(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Tira o 55 inicial se vier (mostramos só DDD + número pro vendedor).
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return local;
}

export default function MpOrdersSection({
  mpConnected,
  refreshSignal = 0,
}: {
  mpConnected: boolean;
  refreshSignal?: number;
}) {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(
    async (p: Period, opts?: { skipCache?: boolean }) => {
      if (!mpConnected) return;
      if (!opts?.skipCache) {
        const cached = readInfoprodCache<OrdersResponse>(CACHE_SECTION, p);
        if (cached && Array.isArray(cached.payments)) {
          setData(cached);
          setError(null);
          return;
        }
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/infoprodutor/mp-payments?period=${p}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Erro ao listar pedidos");
        const safe: OrdersResponse = {
          period: json?.period ?? p,
          payments: Array.isArray(json?.payments) ? (json.payments as Order[]) : [],
          fetchedAt: typeof json?.fetchedAt === "string" ? json.fetchedAt : new Date().toISOString(),
        };
        setData(safe);
        writeInfoprodCache(CACHE_SECTION, p, safe);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro");
      } finally {
        setLoading(false);
      }
    },
    [mpConnected],
  );

  useEffect(() => {
    if (mpConnected) void load(period);
  }, [period, mpConnected, load]);

  useEffect(() => {
    if (refreshSignal === 0) return;
    if (mpConnected) {
      clearInfoprodCache(CACHE_SECTION, period);
      void load(period, { skipCache: true });
    }
  }, [refreshSignal, mpConnected, period, load]);

  const filtered = useMemo(() => {
    const list = data?.payments;
    if (!Array.isArray(list)) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => {
      const name = o.produto?.name?.toLowerCase() ?? "";
      const email = o.customer.email?.toLowerCase() ?? "";
      const cust = o.customer.name?.toLowerCase() ?? "";
      const id = o.paymentId.toLowerCase();
      return name.includes(q) || email.includes(q) || cust.includes(q) || id.includes(q);
    });
  }, [data, filter]);

  if (!mpConnected) {
    return (
      <section className="rounded-xl border border-[#2c2c32] bg-[#27272a] overflow-hidden mt-6">
        <div className="px-3 sm:px-5 py-4 border-b border-[#2c2c32] flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-[#27272a] border border-[#2c2c32] flex items-center justify-center shrink-0">
            <Package className="w-3 h-3 text-[#EE4D2D]" />
          </div>
          <h2 className="text-sm font-bold text-[#f0f0f2] truncate">Pedidos Mercado Pago</h2>
        </div>
        <div className="px-4 sm:px-6 py-10 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#27272a] border border-[#2c2c32] flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-[#EE4D2D]" />
          </div>
          <p className="text-[11px] text-[#9a9aa2] max-w-sm leading-relaxed">
            Conecte sua conta Mercado Pago para ver pedidos com dados de comprador e endereço.
          </p>
          <Link
            href="/configuracoes"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#EE4D2D] hover:bg-[#d63d20] text-white text-xs font-semibold"
          >
            Conectar Mercado Pago
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[#2c2c32] bg-[#27272a] overflow-hidden mt-6">
      <div className="px-3 sm:px-5 py-4 border-b border-[#2c2c32] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-[#27272a] border border-[#2c2c32] flex items-center justify-center shrink-0">
            <Package className="w-3 h-3 text-[#EE4D2D]" />
          </div>
          <h2 className="text-sm font-bold text-[#f0f0f2] truncate">Pedidos Mercado Pago</h2>
          {data?.fetchedAt ? (
            <span className="text-[9px] text-[#7a7a80] hidden sm:inline">
              atualizado {formatRelative(data.fetchedAt)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="inline-flex rounded-lg border border-[#3e3e46] bg-[#222228] p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                disabled={loading}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors disabled:opacity-60 ${
                  period === p.value ? "bg-[#EE4D2D] text-white" : "text-[#c8c8ce] hover:bg-[#2f2f34]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              clearInfoprodCache(CACHE_SECTION, period);
              void load(period, { skipCache: true });
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#3e3e46] text-[10px] font-semibold text-[#d2d2d2] hover:bg-[#2f2f34] disabled:opacity-60"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="px-3 sm:px-5 py-3 border-b border-[#2c2c32] flex items-center gap-2">
        <Search className="w-3.5 h-3.5 text-[#7a7a80] shrink-0" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por produto, comprador ou ID"
          className="flex-1 px-2 py-1 rounded-md border border-[#2c2c32] bg-[#1c1c1f] text-[#f0f0f2] text-[11px] placeholder:text-[#6b6b72] outline-none focus:border-[#EE4D2D]"
        />
      </div>

      {error ? (
        <div className="px-4 sm:px-5 py-3 bg-red-500/10 border-b border-red-500/30 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-300 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-300 leading-relaxed">{error}</p>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="py-10 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#EE4D2D]" />
        </div>
      ) : null}

      {data && filtered.length === 0 ? (
        <div className="px-4 sm:px-6 py-10 text-center">
          <p className="text-[11px] text-[#9a9aa2]">
            Nenhum pedido nesse período{filter ? " com esse filtro" : ""}.
          </p>
        </div>
      ) : null}

      <ul className="divide-y divide-[#2c2c32]">
        {filtered.map((order) => {
          const status = STATUS_LABEL[order.status] ?? {
            label: order.status,
            cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
          };
          return (
            <li key={order.paymentId} className="px-3 sm:px-5 py-3">
              <div className="flex items-start gap-3">
                {order.produto?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={order.produto.imageUrl}
                    alt={order.produto.name}
                    className="w-10 h-10 rounded-lg object-cover bg-[#222228] border border-[#2c2c32] shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[#222228] border border-[#2c2c32] flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4 text-[#6b6b72]" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12px] font-semibold text-[#f0f0f2] truncate">
                      {order.produto?.name ?? "Produto removido"}
                    </p>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${status.cls}`}>
                      {status.label}
                    </span>
                  </div>

                  {/* Bloco do comprador: nome em destaque + e-mail e WhatsApp clicáveis */}
                  <div className="mt-1 space-y-0.5">
                    <p className="text-[11px] font-semibold text-[#f0f0f2] truncate">
                      {order.customer.name ?? "Comprador sem nome"}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      {order.customer.email ? (
                        <a
                          href={`mailto:${order.customer.email}`}
                          className="inline-flex items-center gap-1 text-[10px] text-[#9a9aa2] hover:text-[#f0f0f2] truncate"
                          title="Enviar e-mail"
                        >
                          <Mail className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate max-w-[200px]">{order.customer.email}</span>
                        </a>
                      ) : null}
                      {(() => {
                        const waLink = buildWhatsAppLink(order.customer.phone);
                        const waDisplay = formatWhatsAppDisplay(order.customer.phone);
                        if (!waLink || !waDisplay) {
                          return order.customer.phone ? (
                            <span className="text-[10px] text-[#9a9aa2]">{order.customer.phone}</span>
                          ) : null;
                        }
                        return (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300"
                            title="Abrir conversa no WhatsApp"
                          >
                            <MessageCircle className="w-2.5 h-2.5 shrink-0" />
                            {waDisplay}
                          </a>
                        );
                      })()}
                    </div>
                  </div>

                  <p className="text-[10px] text-[#7a7a80] mt-1">
                    {DELIVERY_LABEL[order.delivery.type]}
                    {order.shippingAddress?.line1 ? ` · ${order.shippingAddress.line1}` : ""}
                    {order.shippingAddress?.city ? ` · ${order.shippingAddress.city}/${order.shippingAddress.state ?? ""}` : ""}
                    {" · "}
                    {formatRelative(order.approvedAt ?? order.createdAt)}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-[13px] font-mono font-bold text-emerald-400 tabular-nums">
                    {formatBRL(order.amount)}
                  </p>
                  <a
                    href={`https://www.mercadopago.com.br/activities/detail/${encodeURIComponent(order.paymentId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[9px] text-[#EE4D2D] hover:underline"
                    title="Ver no painel do Mercado Pago"
                  >
                    Ver no MP <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
