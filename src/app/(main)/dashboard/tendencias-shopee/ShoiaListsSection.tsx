"use client";

/**
 * Lista (curta) das listas de ofertas que o usuário gerou via wizard
 * "Montar Lista com IA". Filtramos pelo prefixo "🤖 Sho.IA · " que o wizard
 * sempre aplica ao nome — assim o usuário enxerga só as listas curadas pela
 * IA, separadas das listas manuais que ele cria pelo Gerador.
 *
 * Reusa o endpoint padrão GET /api/shopee/minha-lista-ofertas/listas. O parent
 * passa `refreshSignal` que muda quando o wizard cria uma lista nova.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";

const SHOIA_PREFIX = "🤖 Sho.IA · ";

type Lista = {
  id: string;
  nome: string;
  totalItens?: number;
  createdAt?: string;
};

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "agora";
  if (ms < 3_600_000) return `há ${Math.round(ms / 60_000)} min`;
  if (ms < 86_400_000) return `há ${Math.round(ms / 3_600_000)}h`;
  return `há ${Math.round(ms / 86_400_000)}d`;
}

export function ShoiaListsSection({ refreshSignal }: { refreshSignal: number }) {
  const [listas, setListas] = useState<Lista[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchListas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shopee/minha-lista-ofertas/listas", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as { data?: Lista[] };
      const all = json.data ?? [];
      // Filtra só as que vieram do wizard (prefixo do mascote).
      setListas(all.filter((l) => l.nome.startsWith(SHOIA_PREFIX)));
    } catch {
      /* ignora */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchListas();
  }, [fetchListas, refreshSignal]);

  if (loading && listas.length === 0) {
    return (
      <div className="rounded-xl border border-[#2c2c32] light:border-zinc-200 bg-[#1c1c1f] light:bg-white px-4 py-6 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-[#ee4d2d]" />
      </div>
    );
  }

  if (listas.length === 0) {
    return (
      <div className="rounded-xl border border-[#2c2c32] light:border-zinc-200 bg-[#1c1c1f] light:bg-white px-4 py-5 text-center">
        <p className="text-[11px] text-[#9a9aa2] light:text-zinc-500">
          Você ainda não criou nenhuma lista pela Sho.IA. Clique em <strong className="text-[#ee4d2d]">MONTAR LISTA COM IA</strong> acima.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#2c2c32] light:border-zinc-200 bg-[#1c1c1f] light:bg-white overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#2c2c32] light:border-zinc-200 flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-[#ee4d2d]" />
        <h2 className="text-[11px] uppercase tracking-widest font-bold text-[#ee4d2d]">
          Minhas listas Sho.IA
        </h2>
        <span className="px-1.5 py-0.5 rounded-full bg-[#ee4d2d]/15 text-[9px] font-bold text-[#ee4d2d]">
          {listas.length}
        </span>
      </div>
      <ul className="divide-y divide-[#2c2c32] light:divide-zinc-200">
        {listas.map((l) => {
          // Nome amigável (sem o prefixo do mascote, que já é informação visual da seção).
          const friendlyName = l.nome.startsWith(SHOIA_PREFIX)
            ? l.nome.slice(SHOIA_PREFIX.length)
            : l.nome;
          return (
            <li
              key={l.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#222228]/50 light:hover:bg-zinc-50 transition-colors"
            >
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0 bg-[#ee4d2d]/15 border border-[#ee4d2d]/30 text-[#ee4d2d] text-[10px] font-bold"
              >
                IA
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-text-primary light:text-zinc-900 truncate">
                  {friendlyName}
                </p>
                <p className="text-[10px] text-[#9a9aa2] light:text-zinc-500">
                  {typeof l.totalItens === "number"
                    ? `${l.totalItens} ${l.totalItens === 1 ? "item" : "itens"}`
                    : "—"}
                  {l.createdAt ? ` · criada ${formatRelative(l.createdAt)}` : ""}
                </p>
              </div>
              <Link
                href={`/dashboard/links?lista=${encodeURIComponent(l.id)}`}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[10px] font-semibold text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100 shrink-0"
              >
                Abrir
                <ExternalLink className="w-3 h-3" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
