"use client";

/**
 * Wizard "Montar Lista com IA" — 3 passos:
 *   1) Selecionar categoria (com nomes reais)
 *   2) Curar produtos (até 50 do top da categoria por score, com fallback em
 *      comissão. Permite desmarcar e adicionar do histórico de Links Gerados.)
 *   3) Nomear lista + SubIDs opcionais → salva tudo num clique:
 *        - cria lista nova com prefixo "🤖 Sho.IA · {nome}"
 *        - converte cada produto em link afiliado (com SubIDs)
 *        - adiciona cada link à lista criada
 *
 * Segue o visual padrão dos modais do app (rounded-2xl, header com badge,
 * footer fixo com botões, scroll interno, light/dark variants).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ImageIcon,
  Layers,
  Link as LinkIcon,
  ListChecks,
  Loader2,
  Save,
  Tag,
  X,
} from "lucide-react";
import Toolist from "@/app/components/ui/Toolist";
import { GeradorPaginationBar } from "@/app/components/shopee/GeradorPaginationBar";

type CategoryOption = { categoryId: number; count: number; name: string };

type SnapshotProduct = {
  itemId: number;
  productName: string;
  imageUrl: string | null;
  price: number | null;
  priceMin: number | null;
  priceMax: number | null;
  commissionRate: number | null;
  ratingStar: number | null;
  score: number;
  isViral: boolean;
  categoryIds: number[];
  productLink: string | null;
};

type HistoryEntry = {
  id: string;
  shortLink: string;
  originUrl: string;
  productName: string;
  imageUrl: string;
  commissionRate: number;
  commissionValue: number;
  priceShopee: number | null;
};

/**
 * Item unificado: pode ser do snapshot (gera link via /shopee-trends/affiliate-link)
 * ou do histórico (gera novo link via /shopee/generate-link com originUrl).
 */
type WizardItem =
  | {
      kind: "snapshot";
      key: string;
      itemId: number;
      productName: string;
      imageUrl: string | null;
      price: number | null;
      priceOriginal: number | null;
      commissionRate: number | null;
      score: number;
    }
  | {
      kind: "history";
      key: string;
      historyId: string;
      originUrl: string;
      productName: string;
      imageUrl: string;
      price: number | null;
      priceOriginal: number | null;
      commissionRate: number | null;
    };

function formatBRL(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(v);
}

export function MontarListaWizard({
  open,
  onClose,
  categories,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryOption[];
  onSaved: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistoryPicker, setShowHistoryPicker] = useState(false);

  // Pool completa de produtos do snapshot (carregado ao abrir o wizard).
  // Mantemos o pool em memória pra que o usuário possa pular entre categorias
  // sem refazer chamadas — o fetch é só uma vez por sessão do wizard.
  const [snapshotProducts, setSnapshotProducts] = useState<SnapshotProduct[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);

  const [listName, setListName] = useState("");
  const [subIdsInput, setSubIdsInput] = useState("");

  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset interno toda vez que abre + busca pool completa de produtos.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSelectedCategoryId(null);
    setSelectedKeys(new Set());
    setShowHistoryPicker(false);
    setListName("");
    setSubIdsInput("");
    setProgress({ done: 0, total: 0 });
    setSavedSuccess(false);
    setError(null);

    // Fetch dedicado: pega 100 produtos por score (cobre praticamente todas
    // as categorias do snapshot atual). O endpoint principal já tem essa
    // resposta cacheada pelo cron horário, então é barato.
    let alive = true;
    setPoolLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/shopee-trends?tab=score&limit=100", {
          cache: "no-store",
        });
        const json = (await res.json()) as { products?: SnapshotProduct[] };
        if (alive) setSnapshotProducts(json.products ?? []);
      } catch {
        /* mantém pool vazio — UI mostra empty state */
      } finally {
        if (alive) setPoolLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  // Filtra produtos da categoria selecionada e ordena por score (fallback comissão).
  const categoryProducts = useMemo<WizardItem[]>(() => {
    if (selectedCategoryId == null) return [];
    return snapshotProducts
      .filter((p) => p.categoryIds.includes(selectedCategoryId))
      .sort((a, b) => {
        // Score primeiro; quando empata (ou ambos baixos), usa comissão como tiebreak.
        if (b.score !== a.score) return b.score - a.score;
        return (b.commissionRate ?? 0) - (a.commissionRate ?? 0);
      })
      .slice(0, 50)
      .map<WizardItem>((p) => ({
        kind: "snapshot",
        key: `snap-${p.itemId}`,
        itemId: p.itemId,
        productName: p.productName,
        imageUrl: p.imageUrl,
        price: p.price ?? p.priceMin,
        priceOriginal: p.priceMax ?? null,
        commissionRate: p.commissionRate,
        score: p.score,
      }));
  }, [snapshotProducts, selectedCategoryId]);

  // Items do histórico que o usuário escolheu adicionar manualmente.
  const [extraHistoryKeys, setExtraHistoryKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) setExtraHistoryKeys(new Set());
  }, [open, selectedCategoryId]);

  const extraItems = useMemo<WizardItem[]>(() => {
    return historyItems
      .filter((h) => extraHistoryKeys.has(`hist-${h.id}`))
      .map<WizardItem>((h) => ({
        kind: "history",
        key: `hist-${h.id}`,
        historyId: h.id,
        originUrl: h.originUrl,
        productName: h.productName,
        imageUrl: h.imageUrl,
        price: h.priceShopee,
        priceOriginal: null,
        commissionRate: h.commissionRate,
      }));
  }, [historyItems, extraHistoryKeys]);

  // Lista combinada (categoria + extras) que o usuário marca/desmarca.
  const allItems = useMemo<WizardItem[]>(
    () => [...categoryProducts, ...extraItems],
    [categoryProducts, extraItems],
  );

  // Quando entra no step 2, default = todos marcados.
  useEffect(() => {
    if (step === 2 && selectedKeys.size === 0 && allItems.length > 0) {
      setSelectedKeys(new Set(allItems.map((i) => i.key)));
    }
  }, [step, allItems, selectedKeys.size]);

  // Carrega histórico só quando abre o picker (lazy).
  const loadHistory = useCallback(async () => {
    if (historyItems.length > 0) {
      setShowHistoryPicker(true);
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/shopee/link-history?page=1&limit=50", {
        cache: "no-store",
      });
      const json = (await res.json()) as { data?: HistoryEntry[] };
      setHistoryItems(json.data ?? []);
      setShowHistoryPicker(true);
    } catch {
      /* ignora */
    } finally {
      setHistoryLoading(false);
    }
  }, [historyItems.length]);

  const toggleItem = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedCategoryName = useMemo(
    () => categories.find((c) => c.categoryId === selectedCategoryId)?.name ?? "",
    [categories, selectedCategoryId],
  );

  const selectedCount = selectedKeys.size;

  const subIdsList = useMemo(() => {
    return subIdsInput
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 3);
  }, [subIdsInput]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (selectedCount === 0) {
      setError("Selecione ao menos 1 produto.");
      return;
    }
    if (listName.trim().length < 2) {
      setError("Dê um nome pra lista (mínimo 2 caracteres).");
      return;
    }
    setError(null);
    setSaving(true);

    try {
      // 1) Cria a lista. Prefixo "🤖 Sho.IA · " sinaliza origem na UI.
      const finalName = `🤖 Sho.IA · ${listName.trim()}`;
      const listRes = await fetch("/api/shopee/minha-lista-ofertas/listas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: finalName }),
      });
      const listJson = (await listRes.json()) as { data?: { id?: string }; error?: string };
      const listaId = listJson.data?.id;
      if (!listRes.ok || !listaId) {
        setError(listJson.error ?? "Falha ao criar lista");
        setSaving(false);
        return;
      }

      // 2) Pra cada produto: gera link afiliado e adiciona à lista. Sequencial
      //    pra não estourar rate-limit da Shopee (pico de 50 produtos × 2 chamadas).
      const selectedItems = allItems.filter((i) => selectedKeys.has(i.key));
      setProgress({ done: 0, total: selectedItems.length });

      let succeeded = 0;
      for (const item of selectedItems) {
        try {
          let shortLink: string | null = null;

          if (item.kind === "snapshot") {
            const r = await fetch("/api/shopee-trends/affiliate-link", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ itemId: item.itemId, subIds: subIdsList }),
            });
            const j = (await r.json()) as { shortLink?: string };
            shortLink = j.shortLink ?? null;
          } else {
            // History: re-gera pra aplicar os SubIDs novos da lista.
            const r = await fetch("/api/shopee/generate-link", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ originUrl: item.originUrl, subIds: subIdsList }),
            });
            const j = (await r.json()) as { shortLink?: string };
            shortLink = j.shortLink ?? null;
          }

          if (shortLink) {
            const addRes = await fetch("/api/shopee/minha-lista-ofertas", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                listaId,
                converterLink: shortLink,
                productName: item.productName,
                imageUrl: item.imageUrl ?? "",
                priceOriginal: item.priceOriginal ?? item.price ?? null,
                pricePromo: item.price ?? null,
              }),
            });
            if (addRes.ok) succeeded += 1;
          }
        } catch {
          /* item específico falhou; segue */
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }

      if (succeeded === 0) {
        setError("Nenhum produto pôde ser adicionado. Verifique suas credenciais Shopee.");
      } else {
        setSavedSuccess(true);
        onSaved();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }, [saving, selectedCount, listName, allItems, selectedKeys, subIdsList, onSaved]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={saving ? undefined : onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-2xl rounded-2xl border border-[#2c2c32] light:border-zinc-200 bg-[#1c1c1f] light:bg-white shadow-2xl flex flex-col max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mascote sobressaindo no topo (position absolute, fora do
                overflow do header) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/tendencias/listaShoo.png"
              alt="Sho.IA"
              aria-hidden
              className="pointer-events-none absolute -top-8 left-3 sm:left-5 w-16 h-16 sm:w-20 sm:h-20 z-10 drop-shadow-[0_6px_18px_rgba(0,0,0,0.4)]"
            />

            {/* Header */}
            <div className="pl-20 sm:pl-24 pr-3 py-3 border-b border-[#2c2c32] light:border-zinc-200 flex items-center gap-3 rounded-t-2xl overflow-hidden">
              <div className="flex-1 min-w-0">
                <h2 className="text-[13px] font-bold text-text-primary light:text-zinc-900 flex items-center gap-1.5">
                  Montar Lista com IA
                  <Toolist
                    variant="below"
                    wide
                    text="Sho.IA monta uma lista pronta a partir de uma categoria."
                  />
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="p-1 rounded-md text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stepper */}
            <StepIndicator step={step} />

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <Step1Categories
                    key="step1"
                    categories={categories}
                    activeId={selectedCategoryId}
                    onSelect={setSelectedCategoryId}
                  />
                ) : step === 2 ? (
                  <Step2Products
                    key="step2"
                    items={allItems}
                    selectedKeys={selectedKeys}
                    onToggle={toggleItem}
                    historyLoading={historyLoading}
                    onOpenHistoryPicker={loadHistory}
                  />
                ) : (
                  <Step3Save
                    key="step3"
                    listName={listName}
                    onListNameChange={setListName}
                    subIdsInput={subIdsInput}
                    onSubIdsChange={setSubIdsInput}
                    subIdsList={subIdsList}
                    selectedCount={selectedCount}
                    categoryName={selectedCategoryName}
                    saving={saving}
                    progress={progress}
                    savedSuccess={savedSuccess}
                  />
                )}
              </AnimatePresence>

              {error ? (
                <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 light:bg-red-50 light:border-red-300 px-3 py-2 text-[11px] text-red-300 light:text-red-800">
                  {error}
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-[#2c2c32] light:border-zinc-200 flex items-center gap-2 rounded-b-2xl bg-[#1c1c1f] light:bg-white">
              {step > 1 && !savedSuccess ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
                  disabled={saving}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[11px] text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100 disabled:opacity-50"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Voltar
                </button>
              ) : null}

              <span className="text-[10px] text-[#7a7a80] light:text-zinc-500 ml-auto">
                {step === 1 ? `${categories.length} categorias` : null}
                {step === 2 ? `${selectedCount} de ${allItems.length} marcados` : null}
                {step === 3 && !saving && !savedSuccess
                  ? `${selectedCount} produtos · ${selectedCategoryName}`
                  : null}
              </span>

              {savedSuccess ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500 text-white text-[11px] font-semibold hover:bg-emerald-600"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Fechar
                </button>
              ) : step === 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={selectedCategoryId == null}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#ee4d2d] text-white text-[11px] font-semibold hover:bg-[#d8431c] disabled:opacity-50"
                >
                  Próximo
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : step === 2 ? (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={selectedCount === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#ee4d2d] text-white text-[11px] font-semibold hover:bg-[#d8431c] disabled:opacity-50"
                >
                  Próximo
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#ee4d2d] text-white text-[11px] font-semibold hover:bg-[#d8431c] disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}

      {/* Modal independente: picker dos Links Gerados (z-index acima do wizard).
          Renderizado dentro do AnimatePresence pra entrar/sair com fade. */}
      <HistoryPickerModal
        open={open && showHistoryPicker}
        historyItems={historyItems}
        initialSelected={extraHistoryKeys}
        onClose={() => setShowHistoryPicker(false)}
        onCommit={(buf) => {
          // Persiste extras + marca como selecionados (default = checked)
          // pra não exigir segundo clique no Step 2.
          setExtraHistoryKeys(buf);
          setSelectedKeys((prev) => new Set([...prev, ...buf]));
          setShowHistoryPicker(false);
        }}
      />
    </AnimatePresence>
  );
}

// ─── Stepper ─────────────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Categoria", icon: Layers },
    { n: 2, label: "Produtos", icon: ListChecks },
    { n: 3, label: "Salvar", icon: Save },
  ];
  return (
    <div className="px-4 py-2.5 border-b border-[#2c2c32] light:border-zinc-200 bg-[#222228] light:bg-zinc-50 flex items-center gap-1">
      {steps.map((s, idx) => {
        const isActive = step === s.n;
        const isDone = step > s.n;
        const Icon = s.icon;
        return (
          <div key={s.n} className="flex items-center gap-1">
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
                isActive
                  ? "bg-[#ee4d2d] text-white"
                  : isDone
                    ? "bg-emerald-500/15 light:bg-emerald-100 text-emerald-400 light:text-emerald-700"
                    : "bg-transparent text-[#7a7a80] light:text-zinc-400"
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                  isActive
                    ? "bg-white/25"
                    : isDone
                      ? "bg-emerald-500/30"
                      : "bg-[#3e3e46] light:bg-zinc-200"
                }`}
              >
                {isDone ? <Check className="w-2.5 h-2.5" /> : s.n}
              </span>
              <Icon className="w-3 h-3" />
              <span className="text-[10px] font-semibold">{s.label}</span>
            </div>
            {idx < steps.length - 1 ? (
              <span
                className={`h-px w-3 ${
                  step > s.n ? "bg-emerald-500/40" : "bg-[#3e3e46] light:bg-zinc-300"
                }`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Selecionar categoria ────────────────────────────────────────────
function Step1Categories({
  categories,
  activeId,
  onSelect,
}: {
  categories: CategoryOption[];
  activeId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
    >
      <p className="text-[12px] text-text-secondary light:text-zinc-600 mb-3">
        Em qual categoria você quer focar?
      </p>
      {categories.length === 0 ? (
        <div className="rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-zinc-50 p-6 text-center">
          <p className="text-[11px] text-[#9a9aa2] light:text-zinc-500">
            Aguardando próxima varredura pra mapear categorias.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => {
            const active = activeId === c.categoryId;
            return (
              <button
                key={c.categoryId}
                type="button"
                onClick={() => onSelect(c.categoryId)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[11px] font-semibold transition-colors ${
                  active
                    ? "border-[#ee4d2d] bg-[#ee4d2d] text-white shadow-[0_0_10px_rgba(238,77,45,0.25)]"
                    : "border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100"
                }`}
              >
                <Tag className="w-3 h-3" />
                {c.name}
                <span className={`text-[9px] ${active ? "text-white/80" : "text-[#7a7a80] light:text-zinc-500"}`}>
                  ({c.count})
                </span>
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ─── Step 2: Curar produtos ──────────────────────────────────────────────────
const STEP2_PAGE_SIZE = 4;

function Step2Products({
  items,
  selectedKeys,
  onToggle,
  historyLoading,
  onOpenHistoryPicker,
}: {
  items: WizardItem[];
  selectedKeys: Set<string>;
  onToggle: (key: string) => void;
  historyLoading: boolean;
  onOpenHistoryPicker: () => void;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / STEP2_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * STEP2_PAGE_SIZE;
  const visible = items.slice(start, start + STEP2_PAGE_SIZE);

  // Reseta a página se a lista de itens encolher (usuário voltou e mudou
  // categoria, ou removeu extras).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-text-secondary light:text-zinc-600">
          {items.length} produtos selecionados pela Sho.IA. Desmarque os que não quiser.
        </p>
        <button
          type="button"
          onClick={onOpenHistoryPicker}
          disabled={historyLoading}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#ee4d2d]/40 bg-[#ee4d2d]/10 text-[10px] font-semibold text-[#ee4d2d] hover:bg-[#ee4d2d]/20"
        >
          {historyLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <LinkIcon className="w-3 h-3" />}
          Adicionar dos Links Gerados
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-zinc-50 p-6 text-center">
          <p className="text-[11px] text-[#9a9aa2] light:text-zinc-500">
            Nenhum produto encontrado nessa categoria. Volte e escolha outra.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-[#2c2c32] light:border-zinc-200 bg-[#222228] light:bg-zinc-50 overflow-hidden">
          {visible.map((item, idx) => {
            const checked = selectedKeys.has(item.key);
            const commValue =
              item.commissionRate != null && item.price != null
                ? item.price * item.commissionRate
                : null;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onToggle(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2 transition-colors ${
                  idx < visible.length - 1 ? "border-b border-[#2c2c32] light:border-zinc-200" : ""
                } ${checked ? "bg-[#1c1c1f] light:bg-white" : "opacity-60 hover:opacity-90"}`}
              >
                <span
                  className={`inline-flex items-center justify-center w-4 h-4 rounded border ${
                    checked
                      ? "border-[#ee4d2d] bg-[#ee4d2d]"
                      : "border-[#5a5a64] light:border-zinc-400"
                  }`}
                >
                  {checked ? <Check className="w-2.5 h-2.5 text-white" /> : null}
                </span>
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.productName}
                    className="w-9 h-9 rounded-md object-cover bg-[#222228] light:bg-zinc-100 border border-[#2c2c32] light:border-zinc-200 shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-md bg-[#222228] light:bg-zinc-100 border border-[#2c2c32] light:border-zinc-200 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4 text-[#6b6b72] light:text-zinc-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[11px] font-semibold text-text-primary light:text-zinc-900 truncate">
                    {item.productName}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-[9px] text-[#9a9aa2] light:text-zinc-500">
                    {commValue != null ? (
                      <span className="text-emerald-400 light:text-emerald-700 font-semibold tabular-nums">
                        Comissão {formatBRL(commValue)}
                      </span>
                    ) : null}
                    {item.kind === "snapshot" ? (
                      <span
                        className={`inline-flex items-center px-1 rounded font-bold tabular-nums ${
                          item.score >= 75
                            ? "bg-[#ee4d2d]/15 text-[#ee4d2d]"
                            : "bg-[#ee4d2d]/10 text-[#ee4d2d]/80"
                        }`}
                      >
                        Score {item.score}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1 rounded bg-[#ee4d2d]/10 text-[#ee4d2d] font-bold">
                        Histórico
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <GeradorPaginationBar
          page={safePage}
          totalPages={totalPages}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          summary={`${items.length} produtos · ${selectedKeys.size} marcados`}
        />
      ) : null}
    </motion.div>
  );
}

/** Modal independente sobre o wizard pra escolher itens do histórico.
 *  z-index maior que o wizard pra ficar por cima.  */
function HistoryPickerModal({
  open,
  historyItems,
  initialSelected,
  onClose,
  onCommit,
}: {
  open: boolean;
  historyItems: HistoryEntry[];
  initialSelected: Set<string>;
  onClose: () => void;
  onCommit: (selected: Set<string>) => void;
}) {
  const [buffer, setBuffer] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) setBuffer(new Set(initialSelected));
  }, [open, initialSelected]);

  const toggle = (id: string) => {
    setBuffer((prev) => {
      const next = new Set(prev);
      const k = `hist-${id}`;
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          // z-index maior que o wizard (z-50) pra ficar por cima
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-md rounded-2xl border border-[#2c2c32] light:border-zinc-200 bg-[#1c1c1f] light:bg-white shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[#2c2c32] light:border-zinc-200 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#ee4d2d]/15 border border-[#ee4d2d]/30">
                <LinkIcon className="w-3.5 h-3.5 text-[#ee4d2d]" />
              </span>
              <h3 className="text-[13px] font-bold text-text-primary light:text-zinc-900 flex-1">
                Adicionar dos Links Gerados
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-md text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {historyItems.length === 0 ? (
                <p className="px-4 py-6 text-[11px] text-[#9a9aa2] light:text-zinc-500 text-center">
                  Nenhum link no histórico.
                </p>
              ) : (
                historyItems.map((h) => {
                  const checked = buffer.has(`hist-${h.id}`);
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => toggle(h.id)}
                      className={`w-full text-left flex items-center gap-2 px-4 py-2 border-b border-[#2c2c32] light:border-zinc-200 last:border-b-0 transition-colors ${
                        checked
                          ? "bg-[#ee4d2d]/10"
                          : "hover:bg-[#ee4d2d]/5"
                      }`}
                    >
                      <span
                        className={`inline-flex items-center justify-center w-4 h-4 rounded border ${
                          checked
                            ? "border-[#ee4d2d] bg-[#ee4d2d]"
                            : "border-[#5a5a64] light:border-zinc-400"
                        }`}
                      >
                        {checked ? <Check className="w-2.5 h-2.5 text-white" /> : null}
                      </span>
                      {h.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={h.imageUrl}
                          alt={h.productName}
                          className="w-8 h-8 rounded bg-[#222228] light:bg-zinc-100 border border-[#2c2c32] light:border-zinc-200 object-cover shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-[#222228] light:bg-zinc-100 border border-[#2c2c32] light:border-zinc-200 flex items-center justify-center shrink-0">
                          <ImageIcon className="w-3.5 h-3.5 text-[#6b6b72] light:text-zinc-400" />
                        </div>
                      )}
                      <span className="flex-1 min-w-0 text-[11px] text-text-primary light:text-zinc-900 truncate">
                        {h.productName || h.shortLink}
                      </span>
                      {h.commissionRate > 0 ? (
                        <span className="text-[9px] text-emerald-400 light:text-emerald-700 shrink-0 tabular-nums">
                          {(h.commissionRate * 100).toFixed(1)}%
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-4 py-3 border-t border-[#2c2c32] light:border-zinc-200 flex items-center justify-between gap-2 rounded-b-2xl bg-[#1c1c1f] light:bg-white">
              <span className="text-[10px] text-[#9a9aa2] light:text-zinc-500">
                {buffer.size} {buffer.size === 1 ? "selecionado" : "selecionados"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[11px] text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => onCommit(buffer)}
                  disabled={buffer.size === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#ee4d2d] text-white text-[11px] font-semibold hover:bg-[#d8431c] disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
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

// ─── Step 3: Nomear + Salvar ─────────────────────────────────────────────────
function Step3Save({
  listName,
  onListNameChange,
  subIdsInput,
  onSubIdsChange,
  subIdsList,
  selectedCount,
  categoryName,
  saving,
  progress,
  savedSuccess,
}: {
  listName: string;
  onListNameChange: (v: string) => void;
  subIdsInput: string;
  onSubIdsChange: (v: string) => void;
  subIdsList: string[];
  selectedCount: number;
  categoryName: string;
  saving: boolean;
  progress: { done: number; total: number };
  savedSuccess: boolean;
}) {
  if (savedSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="text-center py-6"
      >
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/15 light:bg-emerald-100 mb-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 light:text-emerald-700" />
        </div>
        <h3 className="text-[14px] font-bold text-text-primary light:text-zinc-900 mb-1">
          Lista criada com sucesso!
        </h3>
        <p className="text-[11px] text-[#9a9aa2] light:text-zinc-500">
          {progress.done} produtos foram convertidos em links afiliados e adicionados à sua lista.
        </p>
      </motion.div>
    );
  }

  if (saving) {
    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-6"
      >
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#ee4d2d] mb-3" />
        <h3 className="text-[13px] font-bold text-text-primary light:text-zinc-900 mb-1">
          Sho.IA está montando sua lista...
        </h3>
        <p className="text-[11px] text-[#9a9aa2] light:text-zinc-500">
          {progress.done} de {progress.total} produtos processados
        </p>
        <div className="mt-3 w-full max-w-xs mx-auto h-1.5 rounded-full bg-[#3e3e46] light:bg-zinc-200 overflow-hidden">
          <motion.div
            className="h-full bg-[#ee4d2d]"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="space-y-4"
    >
      {/* Resumo */}
      <div className="rounded-lg border border-[#ee4d2d]/30 bg-[#ee4d2d]/5 p-3">
        <p className="text-[9px] uppercase tracking-widest font-bold text-[#ee4d2d] mb-1.5">
          Resumo
        </p>
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <p className="text-[#9a9aa2] light:text-zinc-500">Categoria</p>
            <p className="text-text-primary light:text-zinc-900 font-bold truncate">
              {categoryName || "—"}
            </p>
          </div>
          <div>
            <p className="text-[#9a9aa2] light:text-zinc-500">Produtos</p>
            <p className="text-text-primary light:text-zinc-900 font-bold tabular-nums">
              {selectedCount}
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-widest font-bold text-[#9a9aa2] light:text-zinc-500 mb-1.5">
          Nome da lista
        </label>
        <input
          type="text"
          value={listName}
          onChange={(e) => onListNameChange(e.target.value)}
          placeholder="ex.: Black Friday Beleza, Fim de semana 24/05..."
          className="w-full rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white px-3 py-2 text-[12px] text-text-primary placeholder:text-[#6b6b72] light:placeholder:text-zinc-400 outline-none focus:border-[#ee4d2d]"
        />
      </div>

      <SubIdsCollapsible
        subIdsInput={subIdsInput}
        onSubIdsChange={onSubIdsChange}
        subIdsList={subIdsList}
        selectedCount={selectedCount}
      />
    </motion.div>
  );
}

/** Toggle "Adicionar SubIDs?" + input que só aparece quando ativo. Quando
 *  o toggle desliga, limpa o input pra não vazar valor escondido no save. */
function SubIdsCollapsible({
  subIdsInput,
  onSubIdsChange,
  subIdsList,
  selectedCount,
}: {
  subIdsInput: string;
  onSubIdsChange: (v: string) => void;
  subIdsList: string[];
  selectedCount: number;
}) {
  // Auto-detecta estado inicial: se já tem texto, vem ativo (caso o user
  // tenha digitado, voltado pra trás e voltado de novo).
  const [enabled, setEnabled] = useState<boolean>(subIdsInput.trim().length > 0);

  const toggle = () => {
    if (enabled) {
      // Desligando: limpa o valor pra não persistir hidden.
      onSubIdsChange("");
    }
    setEnabled((v) => !v);
  };

  return (
    <div className="rounded-lg border border-[#3e3e46] light:border-zinc-300 bg-[#1c1c1f] light:bg-zinc-50 p-3">
      <button
        type="button"
        onClick={toggle}
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
              Adicionar SubIDs?
            </p>
            <p className="text-[10px] text-[#9a9aa2] light:text-zinc-500">
              Pra rastrear vendas no ATI cruzando com o ad/criativo.
            </p>
          </div>
        </div>
      </button>

      {enabled ? (
        <div className="mt-3">
          <input
            type="text"
            value={subIdsInput}
            onChange={(e) => onSubIdsChange(e.target.value)}
            placeholder="ex.: black-friday, beleza-2026"
            autoFocus
            className="w-full rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white px-3 py-2 text-[12px] text-text-primary placeholder:text-[#6b6b72] light:placeholder:text-zinc-400 outline-none focus:border-[#ee4d2d]"
          />
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <p className="text-[9px] text-[#7a7a80] light:text-zinc-500">
              Separe por vírgula. Aplicado em todos os {selectedCount} links.
            </p>
            {subIdsList.map((s, i) => (
              <span
                key={`${s}-${i}`}
                className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#3e3e46] light:bg-zinc-200 font-mono text-[9px] text-[#c8c8ce] light:text-zinc-700"
              >
                #{s}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
