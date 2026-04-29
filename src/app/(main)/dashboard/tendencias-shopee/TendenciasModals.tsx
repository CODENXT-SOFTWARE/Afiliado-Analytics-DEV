"use client";

/**
 * Modais reutilizados pela página Tendências Shopee:
 *
 *  - <ConvertLinkModal>: SubID toggle + botão "Converter" → gera link afiliado
 *    via /api/shopee-trends/affiliate-link e copia pro clipboard. Dispara
 *    `onConverted()` pro parent disparar refresh da lista "Links Gerados".
 *
 *  - <AddToListModal>: SubID toggle + criar nova lista + escolher lista. Ao
 *    confirmar, gera link com subIds e adiciona à lista escolhida via POST
 *    /api/shopee/minha-lista-ofertas. UI espelha o padrão visto no app
 *    (criar/escolher lista).
 *
 * Ambos só renderizam um produto por vez (não suportam multi-select porque
 * cada card de tendências expõe ações individuais).
 */

import { Fragment, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Copy,
  Link2,
  Loader2,
  Plus,
  X,
  Zap,
  ChevronDown,
} from "lucide-react";

export type ProductSummary = {
  itemId: number;
  productName: string;
  imageUrl: string | null;
  price: number | null;
  priceMin: number | null;
  priceMax: number | null;
};

type Lista = { id: string; nome: string; totalItens?: number };

// ─── SubID toggle reutilizado pelos dois modais ──────────────────────────────
function SubIdToggle({
  enabled,
  onToggle,
  value,
  onChange,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-lg border border-[#3e3e46] light:border-zinc-300 bg-[#1c1c1f] light:bg-zinc-50 p-3">
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        className="w-full flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 text-left">
          <span
            className={`relative inline-flex w-9 h-5 rounded-full transition-colors ${
              enabled ? "bg-[#ee4d2d]" : "bg-[#3e3e46] light:bg-zinc-300"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                enabled ? "left-[18px]" : "left-0.5"
              }`}
            />
          </span>
          <div>
            <p className="text-[12px] font-semibold text-text-primary light:text-zinc-900">
              Adicionar SubID?
            </p>
            <p className="text-[10px] text-[#9a9aa2] light:text-zinc-500">
              Pra rastrear vendas no ATI cruzando com o ad/criativo.
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#9a9aa2] light:text-zinc-500 transition-transform ${
            enabled ? "rotate-180" : ""
          }`}
        />
      </button>
      {enabled ? (
        <div className="mt-3">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ex.: black-friday, criativo-7, whey-protein"
            autoFocus
            className="w-full rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white px-3 py-2 text-[12px] text-text-primary placeholder:text-[#6b6b72] light:placeholder:text-zinc-400 outline-none focus:border-[#ee4d2d]"
          />
          <p className="mt-1 text-[9px] text-[#7a7a80] light:text-zinc-500">
            Use 2+ caracteres: letras, números, hífen, ponto, underscore.
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ─── ConvertLinkModal ────────────────────────────────────────────────────────
export function ConvertLinkModal({
  product,
  onClose,
  onConverted,
}: {
  product: ProductSummary | null;
  onClose: () => void;
  onConverted: () => void;
}) {
  const [subEnabled, setSubEnabled] = useState(false);
  const [subValue, setSubValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Reset toda vez que abre.
  useEffect(() => {
    if (product) {
      setSubEnabled(false);
      setSubValue("");
      setFeedback(null);
    }
  }, [product]);

  const handleConvert = async () => {
    if (!product) return;
    if (subEnabled && subValue.trim().length < 2) {
      setFeedback({ kind: "err", text: "Use 2+ caracteres no SubID, ou desligue o toggle." });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const subIds = subEnabled && subValue.trim() ? [subValue.trim()] : [];
      const res = await fetch("/api/shopee-trends/affiliate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: product.itemId, subIds }),
      });
      const json = (await res.json()) as { shortLink?: string; error?: string };
      if (!res.ok || !json.shortLink) {
        setFeedback({ kind: "err", text: json.error ?? "Falha ao gerar link" });
        return;
      }
      try {
        await navigator.clipboard.writeText(json.shortLink);
      } catch {
        /* clipboard pode falhar em http; ignora */
      }
      setFeedback({ kind: "ok", text: `Link copiado: ${json.shortLink}` });
      onConverted();
      setTimeout(() => onClose(), 1800);
    } catch (e) {
      setFeedback({ kind: "err", text: e instanceof Error ? e.message : "Erro" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {product ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-md rounded-2xl border border-[#2c2c32] light:border-zinc-200 bg-[#1c1c1f] light:bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[#2c2c32] light:border-zinc-200 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#ee4d2d]/15 border border-[#ee4d2d]/30">
                <Link2 className="w-4 h-4 text-[#ee4d2d]" />
              </span>
              <div className="flex-1 min-w-0">
                <h2 className="text-[13px] font-bold text-text-primary light:text-zinc-900">
                  Converter link afiliado
                </h2>
                <p className="text-[10px] text-[#9a9aa2] light:text-zinc-500 truncate">
                  {product.productName}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-md text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <SubIdToggle
                enabled={subEnabled}
                onToggle={setSubEnabled}
                value={subValue}
                onChange={setSubValue}
              />
              {feedback ? (
                <div
                  className={`rounded-md border px-3 py-2 text-[11px] ${
                    feedback.kind === "ok"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 light:text-emerald-800 light:bg-emerald-50 light:border-emerald-300"
                      : "border-red-500/30 bg-red-500/10 text-red-300 light:text-red-800 light:bg-red-50 light:border-red-300"
                  }`}
                >
                  {feedback.text}
                </div>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[11px] text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConvert}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#ee4d2d] text-white text-[11px] font-semibold hover:bg-[#d8431c] disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                  Converter e copiar
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

// ─── AddToListModal ──────────────────────────────────────────────────────────
export function AddToListModal({
  product,
  listas,
  onClose,
  onAdded,
  onListsRefetch,
}: {
  product: ProductSummary | null;
  listas: Lista[];
  onClose: () => void;
  onAdded: () => void;
  /** Chamado depois que uma nova lista é criada, pra o parent refazer o GET. */
  onListsRefetch: () => Promise<void> | void;
}) {
  const [subEnabled, setSubEnabled] = useState(false);
  const [subValue, setSubValue] = useState("");
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (product) {
      setSubEnabled(false);
      setSubValue("");
      setNewListName("");
      setActiveListId(null);
      setFeedback(null);
    }
  }, [product]);

  const handleCreateList = async () => {
    const nome = newListName.trim();
    if (!nome) return;
    setCreatingList(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/shopee/minha-lista-ofertas/listas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      const json = (await res.json()) as {
        data?: { id?: string };
        error?: string;
      };
      const newId = json.data?.id;
      if (!res.ok || !newId) {
        setFeedback({ kind: "err", text: json.error ?? "Falha ao criar lista" });
        return;
      }
      setNewListName("");
      await onListsRefetch();
      setActiveListId(newId);
    } catch (e) {
      setFeedback({ kind: "err", text: e instanceof Error ? e.message : "Erro" });
    } finally {
      setCreatingList(false);
    }
  };

  const handleConfirm = async () => {
    if (!product || !activeListId) return;
    if (subEnabled && subValue.trim().length < 2) {
      setFeedback({ kind: "err", text: "Use 2+ caracteres no SubID, ou desligue o toggle." });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      // 1) Gera link afiliado (e persiste no histórico)
      const subIds = subEnabled && subValue.trim() ? [subValue.trim()] : [];
      const linkRes = await fetch("/api/shopee-trends/affiliate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: product.itemId, subIds }),
      });
      const linkJson = (await linkRes.json()) as { shortLink?: string; error?: string };
      if (!linkRes.ok || !linkJson.shortLink) {
        setFeedback({ kind: "err", text: linkJson.error ?? "Falha ao gerar link" });
        return;
      }
      // 2) Adiciona à lista
      const addRes = await fetch("/api/shopee/minha-lista-ofertas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listaId: activeListId,
          converterLink: linkJson.shortLink,
          productName: product.productName,
          imageUrl: product.imageUrl ?? "",
          priceOriginal: product.priceMax ?? product.price ?? null,
          pricePromo: product.priceMin ?? product.price ?? null,
        }),
      });
      const addJson = (await addRes.json()) as { error?: string };
      if (!addRes.ok) {
        setFeedback({ kind: "err", text: addJson.error ?? "Falha ao adicionar" });
        return;
      }
      setFeedback({ kind: "ok", text: "Adicionado à lista ✓" });
      onAdded();
      setTimeout(() => onClose(), 1500);
    } catch (e) {
      setFeedback({ kind: "err", text: e instanceof Error ? e.message : "Erro" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {product ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-lg rounded-2xl border border-[#2c2c32] light:border-zinc-200 bg-[#1c1c1f] light:bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[#2c2c32] light:border-zinc-200 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#ee4d2d]/15 border border-[#ee4d2d]/30">
                <Plus className="w-4 h-4 text-[#ee4d2d]" />
              </span>
              <div className="flex-1 min-w-0">
                <h2 className="text-[13px] font-bold text-text-primary light:text-zinc-900">
                  Adicionar à lista
                </h2>
                <p className="text-[10px] text-[#9a9aa2] light:text-zinc-500 truncate">
                  {product.productName}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-md text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              <SubIdToggle
                enabled={subEnabled}
                onToggle={setSubEnabled}
                value={subValue}
                onChange={setSubValue}
              />

              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-[#9a9aa2] light:text-zinc-500 mb-2">
                  Criar nova lista
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleCreateList();
                      }
                    }}
                    placeholder="Ex: achados do dia"
                    className="flex-1 rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white px-3 py-2 text-[12px] text-text-primary placeholder:text-[#6b6b72] light:placeholder:text-zinc-400 outline-none focus:border-[#ee4d2d]"
                  />
                  <button
                    type="button"
                    onClick={handleCreateList}
                    disabled={creatingList || !newListName.trim()}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[11px] font-semibold text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100 disabled:opacity-50"
                  >
                    {creatingList ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Criar
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-[#9a9aa2] light:text-zinc-500">
                    Escolher lista
                  </p>
                  <span className="text-[10px] text-[#7a7a80] light:text-zinc-500">
                    {listas.length} lista{listas.length === 1 ? "" : "s"}
                  </span>
                </div>
                {listas.length === 0 ? (
                  <p className="text-[11px] text-[#9a9aa2] light:text-zinc-500 italic">
                    Nenhuma lista ainda. Crie acima.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {listas.map((l) => {
                      const active = activeListId === l.id;
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setActiveListId(l.id)}
                          className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                            active
                              ? "border-[#ee4d2d] bg-[#ee4d2d]/10"
                              : "border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white hover:bg-[#2f2f34] light:hover:bg-zinc-100"
                          }`}
                        >
                          <span
                            className={`inline-flex items-center justify-center w-4 h-4 rounded-full border ${
                              active ? "border-[#ee4d2d] bg-[#ee4d2d]" : "border-[#5a5a64] light:border-zinc-400"
                            }`}
                          >
                            {active ? <Check className="w-2.5 h-2.5 text-white" /> : null}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-text-primary light:text-zinc-900 truncate">
                              {l.nome}
                            </p>
                            {typeof l.totalItens === "number" ? (
                              <p className="text-[10px] text-[#9a9aa2] light:text-zinc-500">
                                {l.totalItens} {l.totalItens === 1 ? "item" : "itens"}
                              </p>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {feedback ? (
                <div
                  className={`rounded-md border px-3 py-2 text-[11px] ${
                    feedback.kind === "ok"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 light:text-emerald-800 light:bg-emerald-50 light:border-emerald-300"
                      : "border-red-500/30 bg-red-500/10 text-red-300 light:text-red-800 light:bg-red-50 light:border-red-300"
                  }`}
                >
                  {feedback.text}
                </div>
              ) : null}
            </div>

            <div className="px-4 py-3 border-t border-[#2c2c32] light:border-zinc-200 flex items-center justify-between gap-2">
              <span className="text-[10px] text-[#7a7a80] light:text-zinc-500">
                {activeListId ? "Lista selecionada" : "Selecione uma lista"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[11px] text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={busy || !activeListId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#ee4d2d] text-white text-[11px] font-semibold hover:bg-[#d8431c] disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Adicionar
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

// Marker pra não tirar imports não usados em build (ex.: Fragment, Zap).
// Os ícones são reaproveitados em variantes futuras.
const _unused = { Fragment, Zap };
export const __keepImports = _unused;
