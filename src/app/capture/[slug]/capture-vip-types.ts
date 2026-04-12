import type { NotificationsPosition } from "@/lib/capture-notifications";
import type { CaptureBlockPosition } from "@/lib/capture-block-position";
import type { OfertCarouselPosition } from "@/lib/capture-ofert-carousel";

/** Props partilhadas pelos templates VIP (rosa + terroso). */
export type CaptureVipLandingProps = {
  title: string;
  description: string;
  buttonText: string;
  /** Público: /slug/go — preview: pode ser # ou URL externa */
  ctaHref: string;
  logoUrl: string | null;
  buttonColor: string;
  /** Vídeo opcional acima do primeiro CTA */
  youtubeUrl?: string | null;
  /** Posição do embed (abaixo do título, acima/abaixo do botão, fim do card). */
  youtubePosition?: CaptureBlockPosition;
  /** Desliga animação de vagas (preview no dashboard) */
  previewMode?: boolean;
  /** Notificações fictícias na página (default true). */
  notificationsEnabled?: boolean;
  /** Onde o cartão de notificação aparece (default topo). */
  notificationsPosition?: NotificationsPosition;

  /** Carrossel opcional de imagens (upload no dashboard). */
  ofertCarouselEnabled?: boolean;
  ofertCarouselPosition?: OfertCarouselPosition;
  /** URLs públicas já resolvidas (Storage). */
  ofertCarouselImageUrls?: string[];

  /** Mostrar secções promocionais (benefícios, depoimentos, logos, etc.). Default true. */
  promoSectionsEnabled?: boolean;
  /** Títulos já resolvidos para o template atual (servidor ou preview). */
  promoTitles?: {
    benefits: string;
    testimonials: string;
    inGroup: string;
  };
  /** Conteúdo dos cards (formato depende do modelo). */
  promoCards?: unknown;
  /** Overrides de cores / fontes da secção promocional (VIP Rosa / Em branco). */
  promoRosaUi?: unknown;
  /** URLs públicas da miniatura por card (Rosa / Em branco), alinhadas ao array normalizado. */
  promoRosaCardImageUrls?: (string | null)[];
  /** URLs públicas das fotos dos depoimentos Aurora (alinhadas ao array normalizado). */
  promoAuroraAvatarUrls?: (string | null)[];
};
