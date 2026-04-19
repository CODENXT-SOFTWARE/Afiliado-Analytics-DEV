"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Package,
  Users,
  MapPin,
  Phone,
  Mail,
  Printer,
  CreditCard,
  AlertTriangle,
  Loader2,
  Image as ImageIcon,
  Search,
  ChevronDown,
  ChevronRight,
  MessageCircle,
} from "lucide-react";
import EtiquetasModal from "./EtiquetasModal";
import { readInfoprodCache, writeInfoprodCache, clearInfoprodCache } from "@/lib/infoprod/cache";
import { toWhatsAppUrl } from "@/lib/infoprod/stripe-checkout-copy";
import { GeradorPaginationBar } from "@/app/components/shopee/GeradorPaginationBar";

type Period = "7d" | "30d" | "90d" | "all";

type Address = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
};

type Shipping = {
  name: string | null;
  phone: string | null;
  address: Address | null;
} | null;

type DeliveryType = "shipping" | "pickup" | "unknown";

type Order = {
  sessionId: string;
  paymentIntentId: string | null;
  createdAt: string;
  amount: number;
  currency: string;
  refunded: number;
  status: "paid" | "refunded" | "partially_refunded";
  produto: { id: string; name: string; imageUrl: string | null } | null;
  deliveryType?: DeliveryType;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  shipping: Shipping;
};

type OrdersResponse = {
  period: Period;
  orders: Order[];
  fetchedAt: string;
};

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "all", label: "Tudo" },
];

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatAddress(a: Address | null): string {
  if (!a) return "";
  const parts = [a.line1, a.line2].filter(Boolean).join(" — ");
  const city = [a.city, a.state].filter(Boolean).join("/");
  const cep = a.postalCode ? `CEP ${a.postalCode}` : "";
  return [parts, city, cep].filter(Boolean).join(" · ");
}

const CACHE_SECTION = "orders";

export default function StripeOrdersSection({
  stripeConnected,
  refreshSignal = 0,
}: {
  stripeConnected: boolean;
  refreshSignal?: number;
}) {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalSessionIds, setModalSessionIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const ORDERS_PER_PAGE = 4;

  const load = useCallback(
    async (p: Period, opts?: { skipCache?: boolean }) => {
      if (!stripeConnected) return;
      if (!opts?.skipCache) {
        const cached = readInfoprodCache<OrdersResponse>(CACHE_SECTION, p);
        if (cached) {
          setData(cached);
          setError(null);
          return;
        }
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/infoprodutor/stripe-orders?period=${p}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Erro ao carregar pedidos");
        setData(json as OrdersResponse);
        writeInfoprodCache(CACHE_SECTION, p, json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar pedidos");
      } finally {
        setLoading(false);
      }
    },
    [stripeConnected],
  );

  useEffect(() => {
    if (stripeConnected) void load(period);
  }, [period, stripeConnected, load]);

  const lastSignalRef = useRef(refreshSignal);
  useEffect(() => {
    if (refreshSignal === lastSignalRef.current) return;
    lastSignalRef.current = refreshSignal;
    if (stripeConnected) {
      clearInfoprodCache(CACHE_SECTION);
      void load(period, { skipCache: true });
    }
  }, [refreshSignal, stripeConnected, period, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!data) return [];
    if (!q) return data.orders;
    return data.orders.filter((o) => {
      const hay = [
        o.produto?.name,
        o.customer.name,
        o.customer.email,
        o.customer.phone,
        o.shipping?.name,
        o.shipping?.address?.city,
        o.shipping?.address?.state,
        o.shipping?.address?.postalCode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, search]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredPrintable = useMemo(
    () => filtered.filter((o) => !!o.shipping?.address && o.deliveryType !== "pickup"),
    [filtered],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / ORDERS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pagedOrders = useMemo(() => {
    const from = (safePage - 1) * ORDERS_PER_PAGE;
    return filtered.slice(from, from + ORDERS_PER_PAGE);
  }, [filtered, safePage]);

  // Reseta página quando filtro/período mudam
  useEffect(() => {
    setPage(1);
  }, [search, period, data]);

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filteredPrintable.forEach((o) => next.add(o.sessionId));
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const openModalFor = (ids: string[]) => {
    if (ids.length === 0) return;
    setModalSessionIds(ids);
  };
  const closeModal = () => setModalSessionIds([]);
  const openModalSelected = () => openModalFor(Array.from(selected));

  if (!stripeConnected) {
    return (
      <section className="rounded-xl border border-[#2c2c32] bg-[#27272a] overflow-hidden mt-6">
        <div className="px-3 sm:px-5 py-4 border-b border-[#2c2c32] flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-[#635bff]/15 border border-[#635bff]/25 flex items-center justify-center shrink-0">
            <Package className="w-3 h-3 text-[#a8a2ff]" />
          </div>
          <h2 className="text-sm font-bold text-[#f0f0f2] truncate">Pedidos Stripe</h2>
        </div>
        <div className="px-4 sm:px-6 py-10 flex flex-col items-center text-center gap-3">
          <CreditCard className="w-10 h-10 text-[#686868]" />
          <p className="text-[11px] text-[#9a9aa2] max-w-sm leading-relaxed">
            Conecte sua conta Stripe para ver pedidos com dados de comprador e endereço.
          </p>
          <Link
            href="/configuracoes"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#635bff] hover:bg-[#5047e5] text-white text-xs font-semibold"
          >
            Conectar Stripe
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[#2c2c32] bg-[#27272a] overflow-hidden mt-6">
      {/* Header */}
      <div className="px-3 sm:px-5 py-4 border-b border-[#2c2c32] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-[#635bff]/15 border border-[#635bff]/25 flex items-center justify-center shrink-0">
            <Package className="w-3 h-3 text-[#a8a2ff]" />
          </div>
          <h2 className="text-sm font-bold text-[#f0f0f2] truncate">Pedidos Stripe</h2>
          {data ? (
            <span className="text-[9px] text-[#bebebe] bg-[#232328] px-1.5 py-px rounded-full border border-[#3e3e3e] shrink-0">
              {data.orders.length}
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
                  period === p.value ? "bg-[#635bff] text-white" : "text-[#c8c8ce] hover:bg-[#2f2f34]"
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
            title="Atualizar pedidos"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Search + ações de seleção */}
      <div className="px-3 sm:px-5 py-3 border-b border-[#2c2c32] bg-[#222228] flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Search className="h-3.5 w-3.5 text-[#a0a0a0] shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por nome, email, cidade, CEP…"
            className="flex-1 px-3 py-1.5 rounded-lg border border-[#2c2c32] bg-[#1c1c1f] text-[#f0f0f2] text-[11px] placeholder:text-[#6b6b72] outline-none focus:border-[#635bff]"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {filteredPrintable.length > 0 ? (
            <button
              type="button"
              onClick={selectAllVisible}
              className="text-[10px] text-[#a0a0a0] hover:text-white"
            >
              Selecionar todos ({filteredPrintable.length})
            </button>
          ) : null}
          {selected.size > 0 ? (
            <>
              <button
                type="button"
                onClick={clearSelection}
                className="text-[10px] text-[#a0a0a0] hover:text-white"
              >
                Limpar ({selected.size})
              </button>
              <button
                type="button"
                onClick={openModalSelected}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#635bff] hover:bg-[#5047e5] text-white text-[11px] font-semibold"
              >
                <Printer className="w-3 h-3" />
                Imprimir {selected.size} etiqueta{selected.size === 1 ? "" : "s"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="px-4 sm:px-5 py-3 bg-red-500/10 border-b border-red-500/30 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-300 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-300 leading-relaxed">{error}</p>
        </div>
      ) : null}

      <div className="bg-[#1c1c1f]">
        {loading && !data ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#635bff]" />
          </div>
        ) : !data || data.orders.length === 0 ? (
          <div className="py-12 text-center px-4">
            <Users className="w-10 h-10 text-[#686868] mx-auto mb-3" />
            <p className="text-sm font-medium text-[#f0f0f2]">Nenhum pedido no período</p>
            <p className="text-[11px] text-[#9a9aa2] mt-1.5">
              Pedidos pagos via Payment Link aparecerão aqui com dados do comprador e endereço.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-[11px] text-[#9a9aa2]">Nenhum pedido bate com o filtro.</p>
        ) : (
          <ul className="divide-y divide-[#2c2c32]">
            {pagedOrders.map((order) => {
              const isOpen = expanded.has(order.sessionId);
              const isPickup = order.deliveryType === "pickup";
              const noShipping = !isPickup && !order.shipping?.address;
              const canPrintLabel = !isPickup && !!order.shipping?.address;
              const isSelected = selected.has(order.sessionId);
              return (
                <li
                  key={order.sessionId}
                  className={`px-3 sm:px-5 py-3 transition-colors ${isSelected ? "bg-[#635bff]/8" : "hover:bg-[#222228]"}`}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <label
                      className={`flex items-center shrink-0 ${!canPrintLabel ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                      title={
                        isPickup
                          ? "Retirada na loja — não precisa imprimir etiqueta"
                          : noShipping
                            ? "Sem endereço — não pode imprimir etiqueta"
                            : "Selecionar para impressão em lote"
                      }
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!canPrintLabel}
                        onChange={() => toggleSelect(order.sessionId)}
                        className="w-4 h-4 rounded border-[#3e3e46] bg-[#222228] accent-[#635bff]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleExpand(order.sessionId)}
                      className="p-1 rounded-md hover:bg-[#2f2f34] shrink-0"
                      aria-label={isOpen ? "Recolher" : "Expandir"}
                    >
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-[#a0a0a0]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#a0a0a0]" />
                      )}
                    </button>

                    {order.produto?.imageUrl ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-white shrink-0 border border-[#2c2c32]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={order.produto.imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[#222228] shrink-0 flex items-center justify-center border border-[#2c2c32] text-[#6b6b72]">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-[#f0f0f2] truncate">
                        {order.produto?.name ?? "—"}
                      </p>
                      <p className="text-[10px] text-[#9a9aa2] mt-0.5 truncate">
                        {order.customer.name ?? order.shipping?.name ?? order.customer.email ?? "Comprador sem nome"}
                        {order.customer.email ? ` · ${order.customer.email}` : ""}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-bold text-emerald-400">{formatBRL(order.amount)}</p>
                      <p className="text-[9px] text-[#7a7a80]">{formatDate(order.createdAt)}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {order.status !== "paid" ? (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-amber-500/30 bg-amber-500/10 text-amber-300"
                          title={`Reembolsado ${formatBRL(order.refunded)}`}
                        >
                          {order.status === "refunded" ? "Reembolsado" : "Reembolso parcial"}
                        </span>
                      ) : null}
                      {isPickup ? (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          title="Comprador optou por retirar na loja"
                        >
                          <MapPin className="w-2.5 h-2.5" />
                          Retirada
                        </span>
                      ) : noShipping ? (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-amber-500/30 bg-amber-500/10 text-amber-300"
                          title="Pedido feito antes de ativar coleta de endereço"
                        >
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Sem endereço
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openModalFor([order.sessionId])}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#635bff]/40 bg-[#635bff]/10 text-[10px] font-semibold text-[#a8a2ff] hover:bg-[#635bff]/20"
                          title="Imprimir etiqueta de envio"
                        >
                          <Printer className="w-3 h-3" />
                          Etiqueta
                        </button>
                      )}
                    </div>
                  </div>

                  {isOpen ? (
                    <div className="mt-3 ml-8 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                      <div className="p-3 rounded-lg bg-[#222228] border border-[#2c2c32] space-y-1.5">
                        <p className="text-[9px] font-bold text-[#9a9aa2] uppercase tracking-wider mb-1">
                          Comprador
                        </p>
                        <p className="text-[#f0f0f2] font-semibold">
                          {order.customer.name ?? order.shipping?.name ?? "—"}
                        </p>
                        {order.customer.email ? (
                          <p className="text-[#c8c8ce] flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-[#7a7a80]" />
                            <a href={`mailto:${order.customer.email}`} className="hover:underline">
                              {order.customer.email}
                            </a>
                          </p>
                        ) : null}
                        {(() => {
                          const phoneStr = order.customer.phone ?? order.shipping?.phone;
                          if (!phoneStr) return null;
                          const waUrl = toWhatsAppUrl(phoneStr);
                          return (
                            <p className="text-[#c8c8ce] flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-[#7a7a80]" />
                              {waUrl ? (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-400 hover:underline inline-flex items-center gap-1"
                                  title="Abrir conversa no WhatsApp"
                                >
                                  {phoneStr}
                                  <MessageCircle className="w-3 h-3" />
                                </a>
                              ) : (
                                phoneStr
                              )}
                            </p>
                          );
                        })()}
                      </div>

                      <div className="p-3 rounded-lg bg-[#222228] border border-[#2c2c32] space-y-1.5">
                        <p className="text-[9px] font-bold text-[#9a9aa2] uppercase tracking-wider mb-1">
                          {isPickup ? "Modo de entrega" : "Endereço de entrega"}
                        </p>
                        {isPickup ? (
                          <p className="text-emerald-300 text-[11px] flex items-start gap-1.5 leading-relaxed">
                            <MapPin className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                            <span>
                              <strong>Retirada na loja</strong> — combine com o comprador pelo WhatsApp ou e-mail.
                            </span>
                          </p>
                        ) : order.shipping?.address ? (
                          <>
                            {order.shipping.name && order.shipping.name !== order.customer.name ? (
                              <p className="text-[#f0f0f2]">{order.shipping.name}</p>
                            ) : null}
                            <p className="text-[#c8c8ce] flex items-start gap-1.5">
                              <MapPin className="w-3 h-3 text-[#7a7a80] mt-0.5 shrink-0" />
                              <span className="leading-relaxed">{formatAddress(order.shipping.address)}</span>
                            </p>
                          </>
                        ) : (
                          <p className="text-amber-300/90 text-[10px] leading-relaxed">
                            Pedido feito antes da coleta de endereço estar ativa. Atualize o link de checkout do produto em "Meus Produtos" para futuros pedidos.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {filtered.length > ORDERS_PER_PAGE ? (
          <div className="px-3 py-3 border-t border-[#2c2c32] bg-[#222228]">
            <GeradorPaginationBar
              page={safePage}
              totalPages={totalPages}
              summary={`Mostrando ${pagedOrders.length} de ${filtered.length} pedido(s)`}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            />
          </div>
        ) : null}
      </div>

      <EtiquetasModal
        open={modalSessionIds.length > 0}
        sessionIds={modalSessionIds}
        onClose={closeModal}
      />
    </section>
  );
}
