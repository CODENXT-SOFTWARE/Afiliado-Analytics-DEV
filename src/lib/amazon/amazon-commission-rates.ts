/**
 * Tabela de comissão estimada do programa Amazon Associates Brasil por
 * categoria. Os valores são aproximações públicas — a Amazon altera as
 * taxas periodicamente e a comissão real depende do programa do afiliado
 * e da categoria mapeada pela Amazon (que nem sempre bate 1:1 com a
 * categoria escolhida no nosso filtro).
 *
 * Use como ponto de partida pra exibir uma comissão estimada no card. Se
 * o usuário quiser precisão, deve ajustar o valor manualmente no item.
 */

import { isMlListaCategorySlug } from "./ml-lista-category-slugs";

const RATES_BY_SLUG: Record<string, number> = {
  eletronicos: 1.5,
  celulares: 1.0,
  informatica: 4.0,
  games: 1.5,
  eletrodomesticos: 4.0,
  "casa-cozinha": 4.5,
  ferramentas: 4.0,
  esportes: 4.5,
  beleza: 6.0,
  moda: 6.0,
  brinquedos: 4.5,
  bebes: 4.5,
  "pet-shop": 4.0,
  saude: 4.5,
  livros: 4.5,
  automotivo: 4.0,
};

/** Default usado quando não há categoria informada ou o slug não é conhecido. */
export const AMAZON_DEFAULT_COMMISSION_PCT = 4.0;

export function amazonCommissionPctForCategory(slug: string | null | undefined): number {
  if (!slug) return AMAZON_DEFAULT_COMMISSION_PCT;
  const s = slug.trim().toLowerCase();
  if (!isMlListaCategorySlug(s)) return AMAZON_DEFAULT_COMMISSION_PCT;
  return RATES_BY_SLUG[s] ?? AMAZON_DEFAULT_COMMISSION_PCT;
}
