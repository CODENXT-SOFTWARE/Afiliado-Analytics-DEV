/**
 * Payloads padronizados das notificações agendadas. Uma única fonte de verdade
 * pro título, corpo e imagens — referenciada tanto pelo cron dispatcher
 * (`/api/cron/push?slug=...`) quanto pelo botão de teste manual.
 *
 * Convenções:
 *   - `title` é exibido em negrito pelo SO (negrito é nativo do título da
 *     notificação no Android/iOS, então não precisamos de marcação extra).
 *   - `icon` é o ícone redondo pequeno que aparece à esquerda na bandeja.
 *   - `image` é o banner grande mostrado quando o usuário expande a
 *     notificação (suportado no Android Chrome / Edge / Samsung Internet).
 *   - `tag` evita acúmulo de notificações duplicadas — uma nova substitui a
 *     anterior do mesmo tag.
 */

import type { PushPayload } from "@/lib/push/web-push";

export type ScheduledPushSlug =
  | "bom-dia"
  | "comissao-total"
  | "relatorio-shopee"
  | "tendencias-manha"
  | "bom-almoco"
  | "tendencias-tarde"
  | "campanha-direta";

const ICON_DEFAULT = "/pwa-icon-192.png";
const ICON_TENDENCIAS = "/tendencias/cabecasho.png";
const BADGE = "/pwa-icon-192.png";

const URL_DASHBOARD = "/dashboard";
const URL_TENDENCIAS = "/dashboard/shopee-trends";
const URL_INFOPRODUTOR = "/dashboard/infoprodutor";

function brl(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

export function payloadBomDia(): PushPayload {
  return {
    title: "Bom dia, Afiliado",
    body: "É hora de faturar 💲💸",
    icon: ICON_DEFAULT,
    badge: BADGE,
    tag: "aa-bom-dia",
    url: URL_DASHBOARD,
  };
}

export function payloadComissaoTotal(comissaoTotal: number | null): PushPayload {
  if (comissaoTotal == null || !Number.isFinite(comissaoTotal)) {
    return {
      title: "Comissão total",
      body: "Acompanhe seu desempenho hoje 📊",
      icon: ICON_DEFAULT,
      badge: BADGE,
      tag: "aa-comissao-total",
      url: URL_DASHBOARD,
    };
  }
  return {
    title: "Comissão total",
    body: brl(comissaoTotal),
    icon: ICON_DEFAULT,
    badge: BADGE,
    tag: "aa-comissao-total",
    url: URL_DASHBOARD,
  };
}

export function payloadRelatorioShopee(): PushPayload {
  return {
    title: "Relatório Shopee disponível 📊",
    body: "Confira seus números de hoje no dashboard.",
    icon: ICON_DEFAULT,
    badge: BADGE,
    tag: "aa-relatorio-shopee",
    url: URL_DASHBOARD,
  };
}

export function payloadTendencias(): PushPayload {
  return {
    title: "Temos novas tendências",
    body: "Avalie as ofertas de ouro!",
    icon: ICON_TENDENCIAS,
    image: ICON_TENDENCIAS,
    badge: BADGE,
    tag: "aa-tendencias",
    url: URL_TENDENCIAS,
  };
}

export function payloadBomAlmoco(): PushPayload {
  return {
    title: "Bom almoço, Afiliado 📊",
    body: "Não esquece de checar novas ofertas 🚀",
    icon: ICON_DEFAULT,
    badge: BADGE,
    tag: "aa-bom-almoco",
    url: URL_DASHBOARD,
  };
}

export function payloadCampanhaDireta(): PushPayload {
  return {
    title: "Que tal uma campanha direta?",
    body: "Avalie as ofertas escaláveis!",
    icon: ICON_DEFAULT,
    badge: BADGE,
    tag: "aa-campanha-direta",
    url: URL_DASHBOARD,
  };
}

export function payloadNovaVendaInfoprodutor(valorBRL: number): PushPayload {
  return {
    title: "NOVA VENDA 💲💸",
    body: brl(valorBRL),
    icon: ICON_DEFAULT,
    badge: BADGE,
    tag: `aa-nova-venda-${Date.now()}`,
    url: URL_INFOPRODUTOR,
  };
}

export function payloadTeste(): PushPayload {
  return {
    title: "Notificações ativadas 🎉",
    body: "Tudo certo! Você vai receber os avisos do Afiliado Analytics.",
    icon: ICON_DEFAULT,
    badge: BADGE,
    tag: "aa-teste",
    url: URL_DASHBOARD,
  };
}
