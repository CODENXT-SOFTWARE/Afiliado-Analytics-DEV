/**
 * Cache do dashboard ATI na sessão do navegador (sessionStorage).
 * Ao voltar à página no mesmo tab, os dados podem ser reidratados sem novo GET.
 * Fechar o Chrome encerra a sessão — cache some.
 */

import type { ATICreativeRow } from "@/lib/ati/types";

const STORAGE_KEY = "ati:dashboard:v1";

export type ATIDashboardSessionPayload = {
  creatives: ATICreativeRow[];
  validated: Array<{
    id: string;
    adId: string;
    adName: string;
    campaignId: string;
    campaignName: string;
    scaledAt: string;
  }>;
  campaignStatus: Record<string, string>;
  campaignsList: Array<{ id: string; name: string; ad_account_id: string }>;
  adSetList: Array<{
    id: string;
    name: string;
    campaign_id: string;
    ad_account_id: string;
  }>;
  adSetStatusMap: Record<string, string>;
  adStatusMap: Record<string, string>;
  shopeeWarning: string | null;
  campaignIdsTraficoGrupos: string[];
  campaignIdsInfoP?: string[];
};

type Stored = {
  start: string;
  end: string;
  payload: ATIDashboardSessionPayload;
};

export function readAtiSessionCache(
  start: string,
  end: string,
): ATIDashboardSessionPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Stored;
    if (o.start !== start || o.end !== end || !o.payload) return null;
    return o.payload;
  } catch {
    return null;
  }
}

export function writeAtiSessionCache(
  start: string,
  end: string,
  payload: ATIDashboardSessionPayload,
): void {
  if (typeof window === "undefined") return;
  try {
    const stored: Stored = { start, end, payload };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* quota / private mode */
  }
}

/** Mesma lógica dos useState iniciais de data no ATI (para decidir loading inicial). */
export function getDefaultAtiDateRange(): { start: string; end: string } {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return {
    start: d.toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  };
}

export function hasAtiSessionCacheForRange(start: string, end: string): boolean {
  return readAtiSessionCache(start, end) !== null;
}
