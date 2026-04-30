"use client";

import React, { useId, useMemo, useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronDown, Search, X } from "lucide-react";

function normalizeSearch(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function LeadingOptionImage({ src, alt }: { src: string; alt?: string }) {
  return (
    <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
      <Image src={src} alt={alt ?? ""} width={28} height={28} className="h-full w-full object-contain" />
    </span>
  );
}

export type MetaPickerOption = {
  value: string;
  label: string;
  description?: string;
  /** Miniatura à esquerda do nome (ex.: mascote para listas Sho.IA). */
  leadingImageSrc?: string;
  leadingImageAlt?: string;
};

export type MetaSearchablePickerProps = {
  value: string;
  onChange: (v: string) => void;
  options: MetaPickerOption[];
  modalTitle: string;
  modalDescription?: string;
  searchPlaceholder?: string;
  /** Botão grande só quando value === "" e emptyAsTag é false. */
  emptyButtonLabel: string;
  /** Com value "", exibe tag (emptyTagLabel) + lupa — sem botão grande. */
  emptyAsTag?: boolean;
  emptyTagLabel?: string;
  /** No modal, permite definir rascunho vazio e confirmar. */
  allowClear?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  openButtonId?: string;
  className?: string;
  /** Mensagem se options.length === 0 */
  emptyOptionsMessage?: string;
  /**
   * `tag` — etiqueta laranja + lupa (padrão em filtros Meta).
   * `field` — uma linha como input do assistente (texto + seta); abre o mesmo modal.
   */
  triggerVariant?: "tag" | "field";
  /** Não renderiza gatilho; abre só o modal (use com `modalOpen` + `onModalOpenChange`). */
  hideTrigger?: boolean;
  /** Abertura do modal controlada pelo pai (ex.: abrir direto ao clicar num botão da página). */
  modalOpen?: boolean;
  onModalOpenChange?: (open: boolean) => void;
};

/**
 * Select estilo Meta: modal com busca + lista; fora, tag + lupa ou linha tipo campo (`triggerVariant`).
 */
export default function MetaSearchablePicker({
  value,
  onChange,
  options,
  modalTitle,
  modalDescription,
  searchPlaceholder = "Buscar…",
  emptyButtonLabel,
  emptyAsTag = false,
  emptyTagLabel = "Nenhum",
  allowClear = false,
  clearLabel = "Nenhuma opção",
  disabled = false,
  openButtonId,
  className = "",
  emptyOptionsMessage = "Nenhuma opção disponível.",
  triggerVariant = "tag",
  hideTrigger = false,
  modalOpen: modalOpenProp,
  onModalOpenChange,
}: MetaSearchablePickerProps) {
  const titleId = useId();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<string>("");

  const isModalControlled = modalOpenProp !== undefined && onModalOpenChange !== undefined;
  const open = isModalControlled ? modalOpenProp : uncontrolledOpen;
  const setModalOpen = useCallback(
    (next: boolean) => {
      if (isModalControlled) onModalOpenChange(next);
      else setUncontrolledOpen(next);
    },
    [isModalControlled, onModalOpenChange],
  );

  const labelFor = useCallback(
    (v: string) => {
      if (v === "" && emptyAsTag) return emptyTagLabel;
      const o = options.find((x) => x.value === v);
      return o ? o.label : v || emptyTagLabel;
    },
    [options, emptyAsTag, emptyTagLabel]
  );

  const selectedOption = useMemo(() => options.find((x) => x.value === value), [options, value]);

  const openModal = useCallback(() => {
    if (disabled || options.length === 0) return;
    setDraft(value);
    setQuery("");
    setModalOpen(true);
  }, [disabled, options.length, value, setModalOpen]);

  const closeModal = useCallback(() => setModalOpen(false), [setModalOpen]);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return options;
    return options.filter((o) => {
      const l = normalizeSearch(o.label);
      const d = o.description ? normalizeSearch(o.description) : "";
      const v = o.value.toLowerCase();
      return l.includes(q) || d.includes(q) || v.includes(q);
    });
  }, [options, query]);

  const confirm = useCallback(() => {
    onChange(draft);
    setModalOpen(false);
  }, [draft, onChange, setModalOpen]);

  const showBigButton = value === "" && !emptyAsTag;
  const showTagRow = value !== "" || emptyAsTag;

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setDraft(value);
      setQuery("");
    }
    prevOpenRef.current = open;
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, setModalOpen]);

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
                  {modalTitle}
                </h2>
                {modalDescription ? (
                  <p className="text-[11px] text-text-secondary/75 mt-1.5 leading-relaxed">{modalDescription}</p>
                ) : null}
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary/45 pointer-events-none" />
                  <input
                    type="search"
                    autoFocus
                    placeholder={searchPlaceholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full rounded-xl border border-dark-border bg-dark-bg py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-shopee-orange/60 focus:ring-1 focus:ring-shopee-orange/20"
                  />
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3 scrollbar-shopee space-y-2">
                {allowClear && (
                  <button
                    type="button"
                    onClick={() => setDraft("")}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                      draft === ""
                        ? "border-shopee-orange/50 bg-shopee-orange/10 text-text-primary"
                        : "border-dark-border/60 bg-dark-bg/30 text-text-secondary hover:border-shopee-orange/30"
                    }`}
                  >
                    {clearLabel}
                  </button>
                )}
                {filtered.length === 0 ? (
                  <p className="text-sm text-text-secondary text-center py-6">Nada encontrado.</p>
                ) : (
                  filtered.map((o) => {
                    const selected = draft === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setDraft(o.value)}
                        className={`flex w-full items-start gap-2.5 text-left rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                          selected
                            ? "border-shopee-orange/50 bg-shopee-orange/10 text-text-primary"
                            : "border-dark-border/60 bg-dark-bg/30 text-text-secondary hover:border-shopee-orange/30"
                        }`}
                      >
                        {o.leadingImageSrc ? (
                          <LeadingOptionImage src={o.leadingImageSrc} alt={o.leadingImageAlt} />
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{o.label}</span>
                          {o.description ? (
                            <span className="block text-[11px] text-text-secondary/55 font-normal truncate mt-0.5">
                              {o.description}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })
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
          document.body
        )
      : null;

  const fieldTriggerClass =
    "flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-dark-border bg-dark-bg px-4 text-left text-sm transition-colors " +
    "text-text-primary hover:border-shopee-orange/40 focus:outline-none focus:ring-2 focus:ring-shopee-orange/60 focus:border-shopee-orange/60 " +
    "disabled:cursor-not-allowed disabled:opacity-40";

  const lupaBtn = (
    <button
      type="button"
      id={!showBigButton ? openButtonId : undefined}
      onClick={openModal}
      disabled={disabled || options.length === 0}
      title="Alterar seleção"
      aria-label="Abrir busca e escolher"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-shopee-orange/45 bg-shopee-orange/10 text-shopee-orange hover:bg-shopee-orange/18 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      <Search className="h-4 w-4" />
    </button>
  );

  if (options.length === 0 && hideTrigger) {
    return null;
  }

  if (options.length === 0 && !emptyAsTag) {
    return <p className={`text-xs text-amber-500/90 ${className}`}>{emptyOptionsMessage}</p>;
  }

  if (options.length === 0 && emptyAsTag) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <span className="inline-flex items-center rounded-lg border border-dark-border/60 bg-dark-bg/40 px-2.5 py-1.5 text-xs sm:text-sm font-medium text-text-secondary">
          {emptyTagLabel}
        </span>
        <button
          type="button"
          disabled
          title={emptyOptionsMessage}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dark-border/50 bg-dark-bg/30 text-text-secondary opacity-50 cursor-not-allowed"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      {!hideTrigger && showBigButton &&
        (triggerVariant === "field" ? (
          <button
            type="button"
            id={openButtonId}
            onClick={openModal}
            disabled={disabled || options.length === 0}
            className={`${fieldTriggerClass} text-text-secondary/80 font-normal`}
          >
            <span className="truncate">{emptyButtonLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            id={openButtonId}
            onClick={openModal}
            disabled={disabled || options.length === 0}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-shopee-orange/45 bg-shopee-orange/10 px-4 py-2.5 text-sm font-semibold text-shopee-orange hover:bg-shopee-orange/18 disabled:opacity-40 transition-colors"
          >
            <Search className="h-4 w-4 shrink-0" />
            {emptyButtonLabel}
          </button>
        ))}

      {!hideTrigger && showTagRow &&
        (triggerVariant === "field" ? (
          <div className="flex w-full min-w-0 items-stretch gap-2">
            <button
              type="button"
              id={openButtonId}
              onClick={openModal}
              disabled={disabled || options.length === 0}
              className={fieldTriggerClass}
              aria-haspopup="dialog"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {selectedOption?.leadingImageSrc ? (
                  <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                    <Image
                      src={selectedOption.leadingImageSrc}
                      alt={selectedOption.leadingImageAlt ?? ""}
                      width={20}
                      height={20}
                      className="h-full w-full object-contain"
                    />
                  </span>
                ) : null}
                <span
                  className={`min-w-0 truncate font-medium ${
                    value === "" && emptyAsTag ? "text-text-secondary" : ""
                  }`}
                >
                  {labelFor(value)}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
            </button>
            {value !== "" && allowClear ? (
              <button
                type="button"
                onClick={() => onChange("")}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-dark-border bg-dark-bg text-text-secondary hover:border-red-400/50 hover:text-red-400"
                aria-label="Limpar"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs sm:text-sm font-medium ${
                value === "" && emptyAsTag
                  ? "border-dark-border/60 bg-dark-bg/40 text-text-secondary"
                  : "border-shopee-orange/50 bg-shopee-orange/8 text-text-primary"
              }`}
            >
              {selectedOption?.leadingImageSrc ? (
                <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  <Image
                    src={selectedOption.leadingImageSrc}
                    alt={selectedOption.leadingImageAlt ?? ""}
                    width={20}
                    height={20}
                    className="h-full w-full object-contain"
                  />
                </span>
              ) : null}
              <span className="truncate max-w-[min(100%,280px)]">{labelFor(value)}</span>
              {value !== "" && allowClear ? (
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="shrink-0 rounded-md p-0.5 text-text-secondary hover:text-red-400 hover:bg-red-500/10"
                  aria-label="Limpar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </span>
            {lupaBtn}
          </div>
        ))}

      {modal}
    </div>
  );
}
