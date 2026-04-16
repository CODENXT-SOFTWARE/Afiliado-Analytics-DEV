import type { PageTemplate } from "./types";
import { normalizeCapturePageTemplate } from "@/lib/capture-page-template";

export const PAGE_TEMPLATE_OPTIONS: {
  id: PageTemplate;
  title: string;
  description: string;
  badge?: string;
  /** Miniatura em `/public/capture-templates/` (SVG ou imagem). */
  previewSrc: string;
}[] = [
  {
    id: "classic",
    title: "Padrão Afiliado Analytics",
    description:
      "Card claro com gradiente, logo opcional e bloco abaixo do texto: ícones (ofertas, descontos, cupons) ou escassez animada.",
    badge: "Atual",
    previewSrc: "/capture-templates/classic.svg",
  },
  {
    id: "vip_rosa",
    title: "VIP elegante (rosa)",
    description:
      "Página longa estilo landing: faixa de urgência, foto redonda, barra de vagas, lista de benefícios e rodapé — paleta rosa e vinho.",
    previewSrc: "/capture-templates/vip_rosa.svg",
  },
  {
    id: "vip_terroso",
    title: "VIP minimal (terroso)",
    description:
      "Mesma estrutura do VIP elegante com visual bege e marrom, CTA em destaque e cards de benefícios — ideal para público mais sóbrio.",
    previewSrc: "/capture-templates/vip_terroso.svg",
  },
  {
    id: "vinho_rose",
    title: "Vinho rose",
    description:
      "Fundo rosa claro, CTA verde estilo WhatsApp, selo de urgência, lista com ✓ vermelho e marcas parceiras — ideal para grupos de achadinhos.",
    badge: "Novo",
    previewSrc: "/capture-templates/vinho_rose.svg",
  },
  {
    id: "the_new_chance",
    title: "The New Chance",
    description:
      "Card branco com roleta: toque em CLICK para girar, parada em 90%, cupom em destaque e CTA verde — selo de urgência, benefícios e logos parceiras.",
    badge: "Novo",
    previewSrc: "/capture-templates/the_new_chance.svg",
  },
  {
    id: "aurora_ledger",
    title: "Sala Aurora",
    description:
      "Página editorial escura: aurora animada, vidro fosco, copy de direct response, benefícios numerados, barra de urgência elegante e CTA fixo no mobile.",
    badge: "Novo",
    previewSrc: "/capture-templates/aurora_ledger.svg",
  },
  {
    id: "jardim_floral",
    title: "Jardim floral",
    description:
      "Visual fofo e artístico: branco, rosa claro e rosa escuro, flores em SVG, moldura de cartão postal, corações e CTA arredondado — ideal para público mais leve.",
    badge: "Novo",
    previewSrc: "/capture-templates/jardim_floral.svg",
  },
  {
    id: "market_master",
    title: "Market Master",
    description:
      "Landing estilo cupons e promoções: fundo hero PC/mobile, selo de audiência, título em destaque, CTA com pulso, vitrine de produtos, marcas em faixa animada, carrossel de depoimentos e segunda chamada — com YouTube, carrossel de destaques e notificações como nos outros VIP.",
    badge: "Novo",
    previewSrc: "/capture-templates/market_master.svg",
  },
  {
    id: "perfumaria_luxuosa",
    title: "Perfumaria luxuosa",
    description:
      "Visual escuro sofisticado (preto quente, creme e dourado champanhe): faixa superior, foto hero, assinatura social, CTA com halo dourado, bullets editáveis, marcas em movimento, contador social, faixa de produtos e grelha de catálogo — imagens em /luxuoso; YouTube, carrossel e notificações como nos VIP.",
    badge: "Novo",
    previewSrc: "/capture-templates/perfumaria_luxuosa.svg",
  },
  {
    id: "em_branco",
    title: "Em branco",
    description:
      "Assistente em 5 passos: identidade e textos (1–3), visual do cartão no passo 4, e no passo 5 YouTube, carrossel, notificações e secção promocional. Na página pública os extras ficam na mesma coluna, dentro do cartão (zonas como nos VIP).",
    badge: "Novo",
    previewSrc: "/capture-templates/em_branco.svg",
  },
];

export function pageTemplateLabel(t: PageTemplate | null | undefined): string {
  const n = normalizeCapturePageTemplate(t);
  const o = PAGE_TEMPLATE_OPTIONS.find((x) => x.id === n);
  return o?.title ?? "Padrão";
}
