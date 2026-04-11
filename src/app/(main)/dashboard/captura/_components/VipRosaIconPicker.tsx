"use client";

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { vipRosaIconPickerOptions, type VipRosaIconKey } from "@/lib/capture-promo-icons";
import { vipRosaLucideIcon } from "@/lib/vip-rosa-lucide-map";

function normalizeSearch(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export type VipRosaIconPickerProps = {
  value: VipRosaIconKey;
  onChange: (v: VipRosaIconKey) => void;
  /** Por defeito: todos os ícones VIP Rosa (`vipRosaIconPickerOptions`). */
  options?: { value: VipRosaIconKey; label: string }[];
  className?: string;
  openButtonId?: string;
  disabled?: boolean;
};

/**
 * Picker estilo modal Meta: grelha de mini-cards com o ícone Lucide (não só o nome).
 */
export default function VipRosaIconPicker({
  value,
  onChange,
  options = vipRosaIconPickerOptions,
  className = "",
  openButtonId,
  disabled = false,
}: VipRosaIconPickerProps) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<VipRosaIconKey>(value);

  const iconKeys = useMemo(() => options.map((o) => o.value), [options]);

  const openModal = useCallback(() => {
    if (disabled) return;
    setDraft(value);
    setQuery("");
    setOpen(true);
  }, [disabled, value]);

  const closeModal = useCallback(() => setOpen(false), []);

  const filteredKeys = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return [...iconKeys];
    return iconKeys.filter((k) => normalizeSearch(k).includes(q));
  }, [query, iconKeys]);

  const confirm = useCallback(() => {
    onChange(draft);
    setOpen(false);
  }, [draft, onChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const CurrentIcon = vipRosaLucideIcon(value);

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 bg-black/70 backdrop-blur-[2px]"
            role="presentation"
            onClick={closeModal}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="w-full max-w-lg max-h-[min(520px,85vh)] flex flex-col rounded-2xl border border-dark-border bg-dark-card shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 px-4 pt-4 pb-3 border-b border-dark-border/60 bg-dark-bg/40">
                <h2 id={titleId} className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-shopee-orange/15 border border-shopee-orange/25">
                    <Search className="h-4 w-4 text-shopee-orange" />
                  </span>
                  Ícone do card
                </h2>
                <p className="text-[11px] text-text-secondary/75 mt-1.5 leading-relaxed">
                  Toque num ícone. Se usar emoji no card, o emoji substitui o ícone na página.
                </p>
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary/45 pointer-events-none" />
                  <input
                    type="search"
                    autoFocus
                    placeholder="Filtrar por nome (ex.: Ticket, Casa)…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full rounded-xl border border-dark-border bg-dark-bg py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-shopee-orange/60 focus:ring-1 focus:ring-shopee-orange/20"
                  />
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3 scrollbar-thin">
                {filteredKeys.length === 0 ? (
                  <p className="text-sm text-text-secondary text-center py-6">Nada encontrado.</p>
                ) : (
                  <div
                    className="grid grid-cols-5 sm:grid-cols-6 gap-2"
                    role="listbox"
                    aria-label="Ícones disponíveis"
                  >
                    {filteredKeys.map((key) => {
                      const Icon = vipRosaLucideIcon(key);
                      const selected = draft === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          title={key}
                          aria-label={key}
                          aria-selected={selected}
                          onClick={() => setDraft(key)}
                          className={`flex aspect-square items-center justify-center rounded-xl border p-2 transition-all ${
                            selected
                              ? "border-shopee-orange/60 bg-shopee-orange/15 ring-1 ring-shopee-orange/35"
                              : "border-dark-border/60 bg-dark-bg/30 hover:border-shopee-orange/35"
                          }`}
                        >
                          <Icon className="h-7 w-7 shrink-0 text-text-primary" aria-hidden />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="shrink-0 flex justify-end gap-2 px-4 py-3 border-t border-dark-border/60 bg-dark-bg/30">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-dark-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-dark-bg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  className="rounded-xl bg-shopee-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 shadow-[0_2px_12px_rgba(238,77,45,0.25)]"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-shopee-orange/50 bg-shopee-orange/8 text-text-primary">
          <CurrentIcon className="h-5 w-5" aria-hidden />
        </span>
        <button
          type="button"
          id={openButtonId}
          onClick={openModal}
          disabled={disabled}
          title="Alterar ícone"
          aria-label="Abrir grelha de ícones"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-shopee-orange/45 bg-shopee-orange/10 text-shopee-orange hover:bg-shopee-orange/18 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
      {modal}
    </div>
  );
}
