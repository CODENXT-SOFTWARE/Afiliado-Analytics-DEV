"use client";

import { useEffect, useMemo, useState } from "react";

type Rgba = { r: number; g: number; b: number; a: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "").trim();
  if (h.length === 3 && /^[0-9a-f]{3}$/i.test(h)) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  if (h.length === 6 && /^[0-9a-f]{6}$/i.test(h)) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const t = (x: number) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0");
  return `#${t(r)}${t(g)}${t(b)}`;
}

/** Parse #rgb, #rrggbb, rgb(), rgba() */
export function parseCssColor(input: string): Rgba | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  if (s[0] === "#") {
    const slice = s.length >= 7 ? s.slice(0, 7) : s.length === 4 ? s : s.slice(0, 7);
    const rgb = hexToRgb(slice);
    if (rgb) return { ...rgb, a: 1 };
    return null;
  }
  const m = s.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+)\s*)?\)$/i,
  );
  if (m) {
    return {
      r: clamp(Number(m[1]), 0, 255),
      g: clamp(Number(m[2]), 0, 255),
      b: clamp(Number(m[3]), 0, 255),
      a: m[4] !== undefined ? clamp(Number(m[4]), 0, 1) : 1,
    };
  }
  return null;
}

function normalizeHex(v: string) {
  const s = v.trim();
  if (!s) return "";
  return s.startsWith("#") ? s : `#${s}`;
}

function isValidHex6(v: string) {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

function formatAsCss(c: Rgba, allowAlpha: boolean): string {
  const { r, g, b, a } = c;
  if (!allowAlpha || a >= 0.999) return rgbToHex(r, g, b);
  let aStr = a.toFixed(3);
  aStr = aStr.replace(/0+$/, "").replace(/\.$/, "");
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${aStr})`;
}

export type EmBrancoCssColorFieldProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  allowAlpha?: boolean;
  /** Cor do seletor nativo quando o valor não é interpretável */
  fallbackHex?: string;
};

export default function EmBrancoCssColorField({
  label,
  value,
  onChange,
  allowAlpha = false,
  fallbackHex = "#000000",
}: EmBrancoCssColorFieldProps) {
  const parsed = useMemo(() => parseCssColor(value), [value]);
  const hexFromValue = parsed ? rgbToHex(parsed.r, parsed.g, parsed.b) : fallbackHex;
  const [hexDraft, setHexDraft] = useState(hexFromValue);

  useEffect(() => {
    setHexDraft(hexFromValue);
  }, [hexFromValue, value]);

  const applyRgb = (nextHex: string) => {
    const rgb = hexToRgb(nextHex);
    if (!rgb) return;
    const a = parsed?.a ?? 1;
    onChange(formatAsCss({ ...rgb, a: allowAlpha ? a : 1 }, allowAlpha));
  };

  const fallback = useMemo(() => parseCssColor(fallbackHex), [fallbackHex]);
  const displayHex = parsed ? hexFromValue : fallback ? rgbToHex(fallback.r, fallback.g, fallback.b) : "#000000";

  const inputMono =
    "h-11 px-4 bg-dark-bg border border-dark-border rounded-lg text-text-primary font-mono text-sm min-w-0 flex-1 focus:outline-none focus:ring-2 focus:ring-shopee-orange/60";

  if (!parsed) {
    return (
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">{label}</label>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="color"
            value={displayHex}
            onChange={(e) => {
              const rgb = hexToRgb(e.target.value);
              if (!rgb) return;
              onChange(formatAsCss({ ...rgb, a: 1 }, allowAlpha));
            }}
            className="h-11 w-14 cursor-pointer rounded-md border border-dark-border bg-transparent shrink-0"
            aria-label="Selecionar cor"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputMono}
            spellCheck={false}
          />
        </div>
        <p className="mt-1 text-[11px] text-text-secondary/80">
          Valor em CSS livre. Usa #RRGGBB ou rgba() para voltar ao seletor completo.
        </p>
      </div>
    );
  }

  const alphaPct = Math.round(parsed.a * 100);

  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1">{label}</label>
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="color"
          value={hexFromValue}
          onChange={(e) => applyRgb(e.target.value)}
          className="h-11 w-14 cursor-pointer rounded-md border border-dark-border bg-transparent shrink-0"
          aria-label="Selecionar cor"
        />
        <input
          value={hexDraft}
          onChange={(e) => setHexDraft(normalizeHex(e.target.value))}
          onBlur={() => {
            const n = normalizeHex(hexDraft);
            if (isValidHex6(n)) applyRgb(n);
            else setHexDraft(hexFromValue);
          }}
          className={inputMono}
          placeholder="#000000"
          spellCheck={false}
        />
      </div>
      {allowAlpha ? (
        <div className="mt-2">
          <label className="block text-[11px] font-medium text-text-secondary mb-1">Opacidade ({alphaPct}%)</label>
          <input
            type="range"
            min={0}
            max={100}
            value={alphaPct}
            onChange={(e) => {
              const nextA = clamp(Number(e.target.value) / 100, 0, 1);
              onChange(formatAsCss({ ...parsed, a: nextA }, true));
            }}
            className="w-full accent-shopee-orange"
          />
        </div>
      ) : null}
      {!isValidHex6(normalizeHex(hexDraft)) && hexDraft.length > 0 ? (
        <div className="mt-1 text-xs text-red-400">Hex inválido. Formato #RRGGBB.</div>
      ) : null}
    </div>
  );
}
