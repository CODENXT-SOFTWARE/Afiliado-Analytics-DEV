/**
 * Helpers de plano para o backend (API routes).
 * Usam service-role do Supabase para consultar dados.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getEntitlementsForTier,
  type PlanEntitlements,
  type PlanTier,
} from "./plan-entitlements";

export type PlanUsageSnapshot = {
  evolutionInstances: number;
  captureSites: number;
  gruposVendaLists: number;
  gruposVendaGroupsTotal: number;
  activeCampaigns: number;
  videoExportsToday: number;
};

export function utcTodayYmd(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function getPlanTierForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanTier> {
  const { data } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId)
    .single();
  const tier = data?.plan_tier;
  if (tier === "pro" || tier === "padrao" || tier === "legacy" || tier === "staff") return tier;
  return "padrao";
}

export async function getEntitlementsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanEntitlements> {
  const tier = await getPlanTierForUser(supabase, userId);
  return getEntitlementsForTier(tier);
}

export async function getUsageSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanUsageSnapshot> {
  const [
    { count: evoCount },
    { count: captureCount },
    { count: listsCount },
    { count: groupsCount },
    { count: activeCampaignsCount },
    { count: exportsCount },
  ] = await Promise.all([
    supabase
      .from("evolution_instances")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("capture_sites")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("listas_grupos_venda")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("grupos_venda")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("grupos_venda_continuo")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("ativo", true),
    supabase
      .from("video_export_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("export_day", utcTodayYmd()),
  ]);

  return {
    evolutionInstances: evoCount ?? 0,
    captureSites: captureCount ?? 0,
    gruposVendaLists: listsCount ?? 0,
    gruposVendaGroupsTotal: groupsCount ?? 0,
    activeCampaigns: activeCampaignsCount ?? 0,
    videoExportsToday: exportsCount ?? 0,
  };
}

export async function recordVideoExportUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await supabase.from("video_export_usage").insert({
    user_id: userId,
    export_day: utcTodayYmd(),
  });
}
