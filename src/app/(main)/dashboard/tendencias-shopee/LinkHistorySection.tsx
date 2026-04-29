"use client";

/**
 * Seção "Links Gerados" — listagem do histórico de links Shopee do usuário,
 * funcional o suficiente pra ser usada inline na página Tendências (debaixo
 * dos resultados das abas). Reusa a mesma API que o Gerador de Links Shopee:
 * GET/POST/DELETE /api/shopee/link-history. Quando o usuário converte um
 * produto via Tendências, o backend já persiste no histórico, e essa seção
 * recarrega ao receber `refreshSignal` mudando.
 *
 * Não duplica o layout pesado do gerador — versão enxuta com:
 *   - busca por produto/sub_id
 *   - paginação (4 por página)
 *   - copiar / abrir / excluir individual
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy,
  ExternalLink,
  ImageIcon,
  Link as LinkIcon,
  Loader2,
  Search,
  Trash2,
} from "lucide-react";
import { GeradorPaginationBar } from "@/app/components/shopee/GeradorPaginationBar";

type HistoryEntry = {
  id: string;
  shortLink: string;
  originUrl: string;
  subId1: string;
  subId2: string;
  subId3: string;
  productName: string;
  imageUrl: string;
  commissionRate: number;
  commissionValue: number;
  createdAt: string;
};

type ApiResponse = {
  data?: HistoryEntry[];
  total?: number;
  page?: number;
  totalPages?: number;
  error?: string;
};

const PAGE_SIZE = 4;

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function LinkHistorySection({ refreshSignal }: { refreshSignal: number }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPage = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(PAGE_SIZE),
      });
      if (q) params.set("search", q);
      const res = await fetch(`/api/shopee/link-history?${params}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.data) return;
      setEntries(json.data);
      setTotalPages(json.totalPages ?? 1);
      setTotal(json.total ?? 0);
    } catch {
      /* ignora */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPage(page, search);
  }, [fetchPage, page, search, refreshSignal]);

  const handleSearch = () => {
    setSearch(searchInput.trim().toLowerCase());
    setPage(1);
  };

  const handleCopy = async (e: HistoryEntry) => {
    try {
      await navigator.clipboard.writeText(e.shortLink);
      setCopiedId(e.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* ignora */
    }
  };

  const handleDelete = async (e: HistoryEntry) => {
    if (!confirm(`Remover este link do histórico?\n\n${e.productName || e.shortLink}`)) return;
    setDeletingId(e.id);
    try {
      const res = await fetch(`/api/shopee/link-history?id=${encodeURIComponent(e.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      // Recarrega a página atual; se ficou vazia e não é primeira, volta uma.
      const willBeEmpty = entries.length === 1 && page > 1;
      if (willBeEmpty) {
        setPage((p) => Math.max(1, p - 1));
      } else {
        await fetchPage(page, search);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const summary = useMemo(() => {
    if (total === 0) return "Nenhum link gerado ainda";
    if (total === 1) return "1 link no histórico";
    return `${total} links no histórico`;
  }, [total]);

  return (
    <div className="rounded-xl border border-[#2c2c32] light:border-zinc-200 bg-[#1c1c1f] light:bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2c2c32] light:border-zinc-200 flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#ee4d2d]/15 border border-[#ee4d2d]/30">
          <LinkIcon className="w-3.5 h-3.5 text-[#ee4d2d]" />
        </span>
        <h2 className="text-[13px] font-bold text-text-primary light:text-zinc-900">
          Links Gerados
        </h2>
        <span className="px-1.5 py-0.5 rounded-full bg-[#3e3e46] light:bg-zinc-200 text-[9px] font-bold text-[#c8c8ce] light:text-zinc-700">
          {total}
        </span>
        <div className="ml-auto flex items-center gap-2 flex-1 min-w-[160px] max-w-sm rounded-lg border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-zinc-50 px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-[#7a7a80] light:text-zinc-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="Buscar produto, sub ID..."
            className="flex-1 bg-transparent outline-none text-[11px] text-text-primary placeholder:text-[#6b6b72] light:placeholder:text-zinc-400"
          />
        </div>
      </div>

      {loading && entries.length === 0 ? (
        <div className="py-10 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#ee4d2d]" />
        </div>
      ) : null}

      {!loading && entries.length === 0 ? (
        <div className="py-8 text-center px-4">
          <p className="text-[11px] text-[#9a9aa2] light:text-zinc-500">
            {search
              ? "Nenhum link nessa busca."
              : "Nenhum link gerado ainda. Use os botões nos cards acima pra criar."}
          </p>
        </div>
      ) : null}

      {entries.length > 0 ? (
        <ul className="divide-y divide-[#2c2c32] light:divide-zinc-200">
          {entries.map((e) => {
            const subIds = [e.subId1, e.subId2, e.subId3].filter(Boolean);
            return (
              <li
                key={e.id}
                className="px-3 sm:px-4 py-2.5 flex items-center gap-3 hover:bg-[#222228]/50 light:hover:bg-zinc-50 transition-colors"
              >
                {e.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.imageUrl}
                    alt={e.productName}
                    className="w-10 h-10 rounded-lg object-cover bg-[#222228] light:bg-zinc-100 border border-[#2c2c32] light:border-zinc-200 shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[#222228] light:bg-zinc-100 border border-[#2c2c32] light:border-zinc-200 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4 text-[#6b6b72] light:text-zinc-400" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-text-primary light:text-zinc-900 truncate">
                    {e.productName || "Produto sem nome"}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[#9a9aa2] light:text-zinc-500 mt-0.5">
                    <span>{formatDate(e.createdAt)}</span>
                    {subIds.length > 0
                      ? subIds.map((s, i) => (
                          <span
                            key={`${s}-${i}`}
                            className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#3e3e46] light:bg-zinc-200 font-mono text-[9px] text-[#c8c8ce] light:text-zinc-700"
                          >
                            #{s}
                          </span>
                        ))
                      : null}
                    {e.commissionRate > 0 ? (
                      <span className="text-emerald-400 light:text-emerald-700 font-semibold">
                        Comissão {(e.commissionRate * 100).toFixed(1)}% · R${" "}
                        {e.commissionValue.toFixed(2)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(e)}
                    title="Copiar link"
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors ${
                      copiedId === e.id
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : "border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100"
                    }`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={e.shortLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir link"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(e)}
                    disabled={deletingId === e.id}
                    title="Remover do histórico"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[#c8c8ce] light:text-zinc-700 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                  >
                    {deletingId === e.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {totalPages > 1 ? (
        <GeradorPaginationBar
          page={page}
          totalPages={totalPages}
          loading={loading}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          summary={summary}
        />
      ) : null}
    </div>
  );
}
