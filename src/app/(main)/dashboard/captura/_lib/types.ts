export type LayoutVariant = "icons" | "scarcity";

/** classic = fluxo atual (ícones / escassez). vip_* + vinho_rose = landings longas. */
export type PageTemplate =
  | "classic"
  | "vip_rosa"
  | "vip_terroso"
  | "vinho_rose"
  | "the_new_chance"
  | "aurora_ledger"
  | "jardim_floral";

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

};
