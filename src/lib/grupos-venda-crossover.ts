/**
 * Crossover Shopee + Mercado Livre nas listas de ofertas (Grupos de Venda).
 *
 * Quando o usuário escolhe uma lista da Shopee E uma lista do Mercado Livre,
 * a fila de envio precisa alternar **1 Shopee, 1 ML, 1 Shopee, 1 ML…**.
 * Se uma das listas terminar antes da outra, o restante da maior é
 * acrescentado no final (ordem original preservada dentro de cada lista).
 *
 * Aplicado em:
 *  - `src/app/api/grupos-venda/cron-disparo/route.ts` (cron de 10 minutos)
 *  - `src/app/api/grupos-venda/disparar/route.ts`     (disparo manual)
 */
export function interleaveCrossover<T>(shopee: T[], ml: T[]): T[] {
  const out: T[] = [];
  const max = Math.max(shopee.length, ml.length);
  for (let i = 0; i < max; i++) {
    if (i < shopee.length) out.push(shopee[i]);
    if (i < ml.length) out.push(ml[i]);
  }
  return out;
}
