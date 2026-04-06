export type LayoutVariant = "icons" | "scarcity";

/** classic = fluxo atual (ícones / escassez). vip_* = landing longa (template2 + variação terrosa). */
export type PageTemplate = "classic" | "vip_rosa" | "vip_terroso";

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
  meta_pixel_id: string | null; // 👈 ADICIONAR ESTA LINHA
  buttontext?: string | null;
  page_template: PageTemplate | null;

};
