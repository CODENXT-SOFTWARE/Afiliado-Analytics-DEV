"use client";

import { CalendarDays } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  from: string;
  to: string;
  onChangeFrom: (v: string) => void;
  onChangeTo: (v: string) => void;
  minDate: string; // limite mínimo do relatório
  maxDate: string; // limite máximo do relatório
  disabled?: boolean;
  actions?: ReactNode;
};

export default function DateRangeControls({
  from,
  to,
  onChangeFrom,
  onChangeTo,
  minDate,
  maxDate,
  disabled = false,
  actions,
}: Props) {
  // Comparação segura para formato YYYY-MM-DD
  const isAfter = (a: string, b: string) => !!a && !!b && a > b; // a > b => a é depois
  const isBefore = (a: string, b: string) => !!a && !!b && a < b; // a < b => a é antes

  function handleChangeFrom(nextFrom: string) {
    onChangeFrom(nextFrom);

    if (to && nextFrom && isAfter(nextFrom, to)) {
      onChangeTo(nextFrom);
    }
  }

  function handleChangeTo(nextTo: string) {
    onChangeTo(nextTo);

    if (from && nextTo && isBefore(nextTo, from)) {
      onChangeFrom(nextTo);
    }
  }

  const dateInputClass =
    "relative z-0 w-full min-w-0 rounded-lg border border-dark-border bg-dark-bg py-2.5 pl-3 pr-9 text-text-primary text-sm tabular-nums focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange disabled:opacity-40 disabled:cursor-not-allowed sm:min-w-[10.75rem] sm:w-auto";

  return (
    <div
      className="
        flex w-full min-w-0 flex-col gap-3  p-3 shadow-sm
        sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none
        text-sm
      "
      role="group"
      aria-label="Filtro de período"
    >
      <div className="flex items-center gap-2 text-text-secondary shrink-0 sm:gap-2">
        <CalendarDays className="h-4 w-4 text-shopee-orange/90 sm:h-5 sm:w-5" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary/90 sm:text-sm sm:font-normal sm:normal-case sm:tracking-normal">
          Período
        </span>
      </div>

      {/* Duas datas + “até”: em mobile, grelha com larguras iguais; em desktop, linha */}
      <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:flex sm:w-auto sm:min-w-0 sm:flex-row sm:items-center sm:gap-2">
        <div className="commissions-date-picker-wrap relative min-w-0 flex items-center">
          <input
            type="date"
            value={from}
            min={minDate}
            max={maxDate}
            onChange={(e) => handleChangeFrom(e.target.value)}
            disabled={disabled}
            className={dateInputClass}
            aria-label="Data inicial"
          />
          <CalendarDays
            className="pointer-events-none absolute right-2.5 top-1/2 z-0 h-4 w-4 -translate-y-1/2 text-white/90"
            aria-hidden
          />
        </div>

        <span className="px-0.5 text-center text-[11px] font-semibold uppercase tracking-wide text-text-secondary/80 sm:px-1 sm:text-sm sm:font-normal sm:normal-case sm:tracking-normal">
          até
        </span>

        <div className="commissions-date-picker-wrap relative min-w-0 flex items-center">
          <input
            type="date"
            value={to}
            min={minDate}
            max={maxDate}
            onChange={(e) => handleChangeTo(e.target.value)}
            disabled={disabled}
            className={dateInputClass}
            aria-label="Data final"
          />
          <CalendarDays
            className="pointer-events-none absolute right-2.5 top-1/2 z-0 h-4 w-4 -translate-y-1/2 text-white/90"
            aria-hidden
          />
        </div>
      </div>

      {actions ? (
        <div className="w-full shrink-0 pt-0.5 sm:w-auto sm:pt-0 [&_button]:w-full sm:[&_button]:w-auto [&_button]:justify-center">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
