/**
 * Cache em sessionStorage para as seções Vendas e Trackeamento do Infoprodutor.
 * Evita refetch a cada navegação. Invalidado pelo botão "Atualizar" (ou
 * automaticamente ao fechar o navegador, pois é sessionStorage).
 */

const PREFIX = "infoprod:v1:";

function storageKey(section: string, period: string): string {
  return `${PREFIX}${section}:${period}`;
}

export function readInfoprodCache<T>(section: string, period: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(section, period));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeInfoprodCache<T>(section: string, period: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(section, period), JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

/** Remove cache de uma seção específica (todos os períodos) ou de uma combinação. */
export function clearInfoprodCache(section?: string, period?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (section && period) {
      sessionStorage.removeItem(storageKey(section, period));
      return;
    }
    const prefix = section ? `${PREFIX}${section}:` : PREFIX;
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(prefix)) keysToRemove.push(k);
    }
    for (const k of keysToRemove) sessionStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
