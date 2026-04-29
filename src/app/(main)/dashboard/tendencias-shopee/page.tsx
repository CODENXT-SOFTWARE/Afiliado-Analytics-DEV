import { createClient } from "../../../../../utils/supabase/server";
import { redirect } from "next/navigation";
import TendenciasShopeeClient from "./TendenciasShopeeClient";

export default async function TendenciasShopeePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("subscription_status, plan_tier, trial_access_until, shopee_app_id, shopee_api_key_last4")
    .eq("id", user.id)
    .single();

  if (error) redirect("/");
  const trialUntil = profile?.trial_access_until
    ? new Date(profile.trial_access_until as string).getTime()
    : 0;
  const trialExpired =
    profile?.plan_tier === "trial" && trialUntil > 0 && trialUntil < Date.now();
  if (profile?.subscription_status !== "active" || trialExpired) redirect("/minha-conta/renovar");

  const hasShopeeCredentials = Boolean(
    profile?.shopee_app_id && profile?.shopee_api_key_last4,
  );

  return (
    <TendenciasShopeeClient
      hasShopeeCredentials={hasShopeeCredentials}
      userEmail={user.email ?? ""}
    />
  );
}
