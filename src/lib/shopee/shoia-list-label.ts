/** Prefixo usado ao criar listas pelo wizard "Montar Lista com IA" (tendências Shopee). */
export const SHOIA_LIST_NAME_PREFIX = "🤖 Sho.IA · ";

/** Imagem exibida ao lado do nome em pickers/automações para listas criadas pela Sho.IA. */
export const SHOIA_LIST_LEADING_IMAGE_SRC = "/tendencias/cabecasho.png";

export function isShoiaListName(nome: string): boolean {
  return nome.startsWith(SHOIA_LIST_NAME_PREFIX);
}

export function stripShoiaListNamePrefix(nome: string): string {
  return nome.startsWith(SHOIA_LIST_NAME_PREFIX) ? nome.slice(SHOIA_LIST_NAME_PREFIX.length) : nome;
}
