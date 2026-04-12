import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "../../../../../utils/supabase/server";
import { getEntitlementsForUser, getUsageSnapshot } from "@/lib/plan-server";
import { normalizeCapturePageTemplate } from "@/lib/capture-page-template";
import { isValidOptionalYoutubeUrl } from "@/lib/youtube-embed";
import {
  normalizeNotificationsEnabled,
  normalizeNotificationsPosition,
} from "@/lib/capture-notifications";
import { normalizeOfertCarouselPosition } from "@/lib/capture-ofert-carousel";
import { normalizeYoutubePosition } from "@/lib/capture-block-position";
import {
  normalizePromoSectionsEnabled,
  promoSectionTitlesToJsonb,
} from "@/lib/capture-promo-sections";
import { mergePromoCardsDraftFromDb, promoSectionCardsToDbValue } from "@/lib/capture-promo-cards";
import { promoRosaUiOverridesFromUnknown, promoRosaUiToJsonb } from "@/lib/capture-promo-rosa-ui";
import { blankCanvasToDbValue, mergeBlankCanvasFromDb } from "@/lib/capture-blank-canvas";
import type { PageTemplate } from "@/app/(main)/dashboard/captura/_lib/types";

/** INSERT com service role evita RLS/policies que às vezes ignoram colunas novas (ex.: page_template). */
function supabaseServiceRole() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL ausente no servidor.");
  }
  return createSupabaseAdmin(url, key, { auth: { persistSession: false } });
}

export const dynamic = "force-dynamic";

/** 23505 em UNIQUE(userid): legado "1 site por conta" — não confundir com slug duplicado. */
function isUniqueViolationOnUserId(error: { message?: string; details?: string }): boolean {
  const blob = `${error.message ?? ""} ${error.details ?? ""}`;
  const lower = blob.toLowerCase();
  if (/\(\s*userid\s*\)\s*=/i.test(blob) || /\(\s*user_id\s*\)\s*=/i.test(blob)) return true;
  if (lower.includes("userid_key") || lower.includes("user_id_key")) return true;
  return false;
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const ent = await getEntitlementsForUser(supabase, user.id);
  const usage = await getUsageSnapshot(supabase, user.id);

  if (usage.captureSites >= ent.captureLinks) {
    return NextResponse.json(
      { error: `Limite de ${ent.captureLinks} site(s) de captura atingido. Faça upgrade para criar mais.` },
      { status: 403 }
    );
  }

  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  const page_template = normalizeCapturePageTemplate(body.page_template ?? body.pageTemplate);

  const promoTitlesPayload = (() => {
    const raw = body.promo_section_titles ?? body.promoSectionTitles;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      return promoSectionTitlesToJsonb({
        benefits: typeof o.benefits === "string" ? o.benefits : "",
        testimonials: typeof o.testimonials === "string" ? o.testimonials : "",
        inGroup:
          typeof o.in_group === "string"
            ? o.in_group
            : typeof o.inGroup === "string"
              ? o.inGroup
              : "",
      });
    }
    return {} as Record<string, string>;
  })();

  const promoCardsPayload = (() => {
    const raw = body.promo_section_cards ?? body.promoSectionCards;
    if (raw === null || raw === undefined) return null;
    if (!Array.isArray(raw)) return null;
    const draft = mergePromoCardsDraftFromDb(page_template, raw);
    return promoSectionCardsToDbValue(page_template as PageTemplate, draft);
  })();

  const blankCanvasPayload =
    page_template === "em_branco"
      ? blankCanvasToDbValue(mergeBlankCanvasFromDb(body.blank_canvas_json ?? body.blankCanvasJson))
      : null;

  const promoRosaUiInsert = (() => {
    const raw = body.promo_rosa_ui ?? body.promoRosaUi;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    return promoRosaUiToJsonb(promoRosaUiOverridesFromUnknown(raw));
  })();

  const trimOrNull = (v: unknown): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    return s.length ? s : null;
  };

  const slug =
    typeof body.slug === "string"
      ? body.slug.trim()
      : typeof body.slug === "number"
        ? String(body.slug).trim()
        : "";
  if (!slug) {
    return NextResponse.json({ error: "Slug obrigatório." }, { status: 400 });
  }

  const whatsapp_url =
    typeof body.whatsapp_url === "string"
      ? body.whatsapp_url.trim()
      : typeof body.whatsappUrl === "string"
        ? body.whatsappUrl.trim()
        : "";
  if (!whatsapp_url) {
    return NextResponse.json({ error: "Link do botão obrigatório." }, { status: 400 });
  }

  const youtubeRaw =
    typeof body.youtube_url === "string"
      ? body.youtube_url.trim()
      : typeof body.youtubeUrl === "string"
        ? body.youtubeUrl.trim()
        : "";
  if (youtubeRaw && !isValidOptionalYoutubeUrl(youtubeRaw)) {
    return NextResponse.json(
      { error: "Link do YouTube inválido. Use um URL de vídeo ou o ID de 11 caracteres." },
      { status: 400 },
    );
  }

  const insertRow = {
    domain:
      (typeof body.domain === "string" && body.domain.trim()) || "s.afiliadoanalytics.com.br",
    slug,
    title: trimOrNull(body.title),
    description: trimOrNull(body.description),
    button_text: trimOrNull(body.button_text ?? body.buttonText),
    whatsapp_url,
    button_color:
      (typeof body.button_color === "string" && body.button_color.trim()) ||
      (typeof body.buttonColor === "string" && body.buttonColor.trim()) ||
      "#25D366",
    layout_variant:
      (typeof body.layout_variant === "string" && body.layout_variant.trim()) ||
      (typeof body.layoutVariant === "string" && body.layoutVariant.trim()) ||
      "icons",
    meta_pixel_id: trimOrNull(body.meta_pixel_id ?? body.metaPixelId),
    page_template,
    youtube_url: youtubeRaw ? youtubeRaw : null,
    youtube_position: normalizeYoutubePosition(
      body.youtube_position ?? body.youtubePosition,
    ),
    notifications_enabled: normalizeNotificationsEnabled(
      body.notifications_enabled ?? body.notificationsEnabled,
    ),
    notifications_position: normalizeNotificationsPosition(
      body.notifications_position ?? body.notificationsPosition,
    ),
    ofert_carousel_enabled: false,
    ofert_carousel_position: normalizeOfertCarouselPosition(
      body.ofert_carousel_position ?? body.ofertCarouselPosition,
    ),
    ofert_carousel_image_paths: [] as unknown[],
    promo_sections_enabled: normalizePromoSectionsEnabled(
      body.promo_sections_enabled ?? body.promoSectionsEnabled,
    ),
    promo_section_titles: promoTitlesPayload,
    promo_section_cards: promoCardsPayload,
    promo_rosa_ui: promoRosaUiInsert,
    blank_canvas_json: blankCanvasPayload,
    userid: user.id,
  };

  let data: Record<string, unknown> | null = null;
  let error: { message?: string; code?: string; details?: string } | null = null;

  try {
    const admin = supabaseServiceRole();
    const ins = await admin.from("capture_sites").insert(insertRow).select().single();
    data = ins.data as Record<string, unknown> | null;
    error = ins.error;
  } catch (boot) {
    return NextResponse.json(
      { error: boot instanceof Error ? boot.message : "Erro de configuração do servidor." },
      { status: 500 }
    );
  }

  if (error) {
    const dup = "code" in error && error.code === "23505";
    if (dup && isUniqueViolationOnUserId(error)) {
      return NextResponse.json(
        {
          error:
            "O banco ainda só permite um site de captura por conta (regra antiga em userid). " +
            "Execute no Supabase (SQL Editor) a migration `20250325_capture_sites_multiple_per_user.sql` deste projeto, " +
            "ou remova manualmente a constraint UNIQUE em userid e garanta UNIQUE(domain, slug).",
          code: "capture_sites_userid_unique_legacy",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        error: dup
          ? "Esse slug já existe neste domínio (link público único em toda a plataforma). Outro usuário pode estar usando, ou você já tem outro site com esse slug. Escolha outro."
          : error.message,
      },
      { status: dup ? 409 : 500 }
    );
  }
  return NextResponse.json(data);
}
