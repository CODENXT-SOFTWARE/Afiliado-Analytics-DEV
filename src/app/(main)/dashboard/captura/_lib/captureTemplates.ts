import type { PageTemplate } from "./types";
import { normalizeCapturePageTemplate } from "@/lib/capture-page-template";

export const PAGE_TEMPLATE_OPTIONS: {
  id: PageTemplate;
  title: string;
  description: string;
  badge?: string;
}[] = [
  {
    id: "classic",
    title: "Padrão Afiliado Analytics",
    description:
      "Card claro com gradiente, logo opcional e bloco abaixo do texto: ícones (ofertas, descontos, cupons) ou escassez animada.",
    badge: "Atual",
  },
  {
    id: "vip_rosa",
    title: "VIP elegante (rosa)",
    description:
      "Página longa estilo landing: faixa de urgência, foto redonda, barra de vagas, lista de benefícios e rodapé — paleta rosa e vinho.",
  },
  {
    id: "vip_terroso",
    title: "VIP minimal (terroso)",
    description:
      "Mesma estrutura do VIP elegante com visual bege e marrom, CTA em destaque e cards de benefícios — ideal para público mais sóbrio.",
  },
];

export function pageTemplateLabel(t: PageTemplate | null | undefined): string {
  const n = normalizeCapturePageTemplate(t);
  const o = PAGE_TEMPLATE_OPTIONS.find((x) => x.id === n);
  return o?.title ?? "Padrão";
}
