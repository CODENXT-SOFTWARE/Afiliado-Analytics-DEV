export type LayoutVariant = "icons" | "scarcity";

/** classic = fluxo atual (ícones / escassez). vip_* + vinho_rose = landings longas. */
export type PageTemplate =
  | "classic"
  | "vip_rosa"
  | "vip_terroso"
  | "vinho_rose"
  | "the_new_chance"
  | "aurora_ledger"
  | "jardim_floral"
  | "em_branco";

export type CaptureSiteRow = {
  id: string;
  userid: string;
  domain: string;
  slug: string;

  title: string | null;
  description: string | null;
  whatsapp_url: string;

  button_color: string;
  active: boolean;
  expiresat: string | null;

  view_count: number;
  cta_click_count: number;

  created_at: string;
  updated_at: string;

  logopath: string | null;

  // NEW
  layout_variant: LayoutVariant | null;
  meta_pixel_id: string | null;
  button_text: string | null;
  page_template: PageTemplate | null;

  /** URL ou ID do YouTube; opcional — embed acima do 1.º CTA quando preenchido. */
  youtube_url: string | null;
  /** Onde o embed do YouTube aparece (default `above_cta`; `card_end` = fim do bloco principal). */
  youtube_position: string | null;

  /** Notificações fictícias (entrada no grupo / cupom); default true. */
  notifications_enabled: boolean | null;
  /** `top` = sob o topo da viewport; `bottom` = acima do rodapé. */
  notifications_position: string | null;

  ofert_carousel_enabled: boolean | null;
  ofert_carousel_position: string | null;
  /** JSON array de até 4 strings (paths no Storage) ou null por slot. */
  ofert_carousel_image_paths: unknown;

  /** Blocos tipo benefícios / depoimentos nos templates VIP. */
  promo_sections_enabled?: boolean | null;
  /** `{ benefits?, testimonials?, in_group? }` — strings curtas. */
  promo_section_titles?: unknown;

  /** Array de cards conforme `page_template` (benefícios, depoimentos, linhas simples). */
  promo_section_cards?: unknown;

  /** Overrides visuais opcionais da secção promocional (modelos com cards estilo VIP Rosa / Em branco). */
  promo_rosa_ui?: unknown;

  /** Tema visual exclusivo do modelo `em_branco`. */
  blank_canvas_json?: unknown;
};
