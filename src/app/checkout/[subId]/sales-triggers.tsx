"use client";

/**
 * Gatilhos de venda usados no checkout InfoP.
 *   - SaleNotificationsToast: toasts rotativos "Fulano acabou de comprar"
 *   - CountdownBar: barra sticky no topo com cronômetro regressivo
 *   - StockCounter: contador de estoque diminuindo
 *   - ViewersBadge: badge flutuante "X pessoas vendo agora"
 *   - GuaranteeBadge: selo de garantia abaixo do botão Pagar
 *   - PayButton: botão com efeito "light sweep" e cor custom
 *
 * Toda a config chega via props (vêm do /api/checkout/[subId]/info).
 */

import { useEffect, useRef, useState } from "react";
import { Eye, ShieldCheck, Clock, Flame, Package, X } from "lucide-react";

export type TriggerConfig = {
  payButton: { color: string; lightSweep: boolean };
  saleNotifications: boolean;
  countdown: {
    enabled: boolean;
    minutes: number;
    message: string;
    expiredMessage: string;
  };
  stock: { enabled: boolean; initial: number };
  viewers: { enabled: boolean; min: number; max: number };
  guarantee: { enabled: boolean; text: string };
};

export type TriggerPalette = {
  mode: "dark" | "light";
  cardBg: string;
  cardBorder: string;
  text: string;
  textMuted: string;
};

// ──────────────────────────────────────────────────────────────
// Dados sintéticos pra rotacionar nos gatilhos sociais.
// ──────────────────────────────────────────────────────────────

const BUYER_FIRST_NAMES = [
  "Maria", "Ana", "Juliana", "Camila", "Fernanda", "Patrícia", "Beatriz", "Letícia",
  "Carla", "Amanda", "João", "Pedro", "Lucas", "Gabriel", "Matheus", "Rafael",
  "Bruno", "Thiago", "Carlos", "Rodrigo", "Paulo", "André", "Felipe", "Rodrigo",
  "Marcelo", "Fábio", "Leonardo", "Gustavo", "Vinícius", "Ricardo",
];

const BUYER_CITIES = [
  "São Paulo/SP", "Rio de Janeiro/RJ", "Belo Horizonte/MG", "Porto Alegre/RS",
  "Curitiba/PR", "Recife/PE", "Salvador/BA", "Fortaleza/CE", "Brasília/DF",
  "Manaus/AM", "Goiânia/GO", "Florianópolis/SC", "Campinas/SP", "Natal/RN",
  "Vitória/ES", "Aracaju/SE", "Teresina/PI", "João Pessoa/PB", "Cuiabá/MT",
  "Uberlândia/MG", "Santos/SP", "Ribeirão Preto/SP", "Sorocaba/SP", "Londrina/PR",
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function obfuscateLastName(name: string): string {
  // "Maria" → "Maria S." (letra aleatória pra dar uma cara de nome + sobrenome)
  const letter = String.fromCharCode(65 + randInt(0, 25));
  return `${name} ${letter}.`;
}

// ──────────────────────────────────────────────────────────────
// 1. Notificações de compra (toasts rotativos)
// ──────────────────────────────────────────────────────────────

type Notif = { id: number; buyer: string };

export function SaleNotificationsToast({
  productImageUrl,
  palette,
}: {
  productImageUrl: string | null;
  palette: TriggerPalette;
}) {
  const [notif, setNotif] = useState<Notif | null>(null);
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function schedule() {
      const delayMs = randInt(12, 28) * 1000;
      timer.current = setTimeout(() => {
        counter.current += 1;
        setNotif({
          id: counter.current,
          buyer: obfuscateLastName(pickRandom(BUYER_FIRST_NAMES)),
        });
        setTimeout(() => setNotif(null), 7000);
        schedule();
      }, delayMs);
    }
    timer.current = setTimeout(() => {
      counter.current += 1;
      setNotif({
        id: counter.current,
        buyer: obfuscateLastName(pickRandom(BUYER_FIRST_NAMES)),
      });
      setTimeout(() => setNotif(null), 7000);
      schedule();
    }, 3500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!notif) return null;
  return (
    <div
      key={notif.id}
      className="fixed top-14 right-4 z-[60] max-w-[320px] animate-slide-in-right"
      role="status"
      aria-live="polite"
    >
      <div
        className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 shadow-2xl"
        style={{
          background: palette.cardBg,
          borderColor: palette.cardBorder,
        }}
      >
        <div
          className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center shrink-0"
          style={{ background: palette.mode === "light" ? "#f4f4f5" : "#222228" }}
        >
          {productImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={productImageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Package className="w-4 h-4" style={{ color: palette.textMuted }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-[12px] font-semibold leading-tight truncate"
            style={{ color: palette.text }}
          >
            {notif.buyer}
          </p>
          <p
            className="text-[10px] leading-tight mt-0.5 truncate"
            style={{ color: palette.textMuted }}
          >
            acabou de comprar
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNotif(null)}
          className="shrink-0 transition-colors"
          style={{ color: palette.textMuted }}
          aria-label="Fechar"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 2. Countdown bar (sticky no topo)
// ──────────────────────────────────────────────────────────────

export function CountdownBar({
  minutes,
  message,
  expiredMessage,
}: {
  minutes: number;
  message: string;
  expiredMessage: string;
}) {
  const totalSeconds = Math.max(60, minutes * 60);
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const expired = remaining <= 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div
      className={`sticky top-0 z-50 w-full border-b backdrop-blur ${
        expired ? "animate-blink" : ""
      }`}
      style={{
        background: expired ? "rgba(239, 68, 68, 0.75)" : "rgba(239, 68, 68, 0.6)",
        borderColor: expired ? "rgba(239, 68, 68, 0.9)" : "rgba(239, 68, 68, 0.4)",
      }}
    >
      <div className="max-w-3xl mx-auto px-4 py-4 sm:py-5 flex items-center justify-center gap-3 text-white text-center">
        {expired ? (
          <Flame className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
        ) : (
          <Clock className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
        )}
        <p className="text-[13px] sm:text-[15px] font-semibold leading-tight">
          {expired ? expiredMessage : message}
        </p>
        <span className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-[14px] sm:text-[16px] font-mono font-bold tabular-nums shrink-0 bg-black/35">
          {mm}:{ss}
        </span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 3. Contador de estoque
// ──────────────────────────────────────────────────────────────

export function StockCounter({
  initial,
  palette,
}: {
  initial: number;
  palette: TriggerPalette;
}) {
  // Mantém pelo menos 1 pra nunca bater "esgotado" e bloquear conversão.
  const floor = 1;
  const [stock, setStock] = useState(Math.max(floor, initial));

  useEffect(() => {
    const id = setInterval(() => {
      setStock((s) => (s > floor ? s - 1 : s));
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  const low = stock <= 5;
  return (
    <div
      className="rounded-xl border px-4 py-2.5 flex items-center gap-2.5"
      style={{
        background: low ? "rgba(239, 68, 68, 0.08)" : palette.cardBg,
        borderColor: low ? "#ef4444" : palette.cardBorder,
      }}
    >
      <Flame
        className="w-4 h-4 shrink-0"
        style={{ color: low ? "#ef4444" : palette.textMuted }}
      />
      <p className="text-[12px] leading-tight" style={{ color: palette.text }}>
        {low ? "Últimas " : "Apenas "}
        <span className="font-bold tabular-nums" style={{ color: low ? "#ef4444" : palette.text }}>
          {stock}
        </span>{" "}
        {stock === 1 ? "unidade disponível" : "unidades em estoque"}
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 4. Badge de visualizadores em tempo real
// ──────────────────────────────────────────────────────────────

export function ViewersBadge({ min, max }: { min: number; max: number }) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const [count, setCount] = useState(() => randInt(lo, hi));

  useEffect(() => {
    const id = setInterval(() => {
      setCount((prev) => {
        const delta = randInt(-3, 3);
        const next = prev + delta;
        if (next < lo) return lo;
        if (next > hi) return hi;
        return next;
      });
    }, 5_000);
    return () => clearInterval(id);
  }, [lo, hi]);

  return (
    <div className="fixed top-4 right-4 z-[55] pointer-events-none">
      <div className="flex items-center gap-2 sm:gap-2.5 rounded-full border border-white/10 bg-black/35 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 shadow-lg">
        <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
          <span className="relative h-full w-full rounded-full bg-emerald-400" />
        </span>
        <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/85" />
        <span className="text-[11px] sm:text-[13px] text-white font-semibold tabular-nums">
          {count}
        </span>
        <span className="text-[10px] sm:text-[11px] text-white/70">vendo agora</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 5. Selo de garantia (vai abaixo do botão Pagar)
// ──────────────────────────────────────────────────────────────

export function GuaranteeBadge({
  text,
  palette,
}: {
  text: string;
  palette: TriggerPalette;
}) {
  return (
    <div
      className="rounded-xl border px-3 py-2 flex items-center gap-2"
      style={{
        background:
          palette.mode === "light" ? "rgba(5, 150, 105, 0.08)" : "rgba(16, 185, 129, 0.1)",
        borderColor: palette.mode === "light" ? "rgba(5, 150, 105, 0.3)" : "rgba(16, 185, 129, 0.35)",
      }}
    >
      <ShieldCheck
        className="w-4 h-4 shrink-0"
        style={{ color: palette.mode === "light" ? "#059669" : "#34d399" }}
      />
      <p className="text-[11px] leading-snug" style={{ color: palette.text }}>
        {text}
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 6. Botão Pagar com "light sweep" e cor customizável
// ──────────────────────────────────────────────────────────────

export function PayButton({
  color,
  lightSweep,
  disabled,
  loading,
  children,
}: {
  color: string;
  lightSweep: boolean;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="relative overflow-hidden w-full inline-flex items-center justify-center gap-2 px-4 py-5 rounded-xl text-white text-[15px] font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:brightness-110"
      style={{
        background: color,
        boxShadow: `0 4px 14px -4px ${color}66`,
      }}
    >
      {children}
      {lightSweep && !disabled && !loading ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-1/3 animate-light-sweep"
          style={{
            background:
              "linear-gradient(110deg, transparent 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 70%, transparent 100%)",
          }}
        />
      ) : null}
    </button>
  );
}

