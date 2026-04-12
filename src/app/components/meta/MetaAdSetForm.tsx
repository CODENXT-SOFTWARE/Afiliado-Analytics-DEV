"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Target, Loader2, Zap, HelpCircle } from "lucide-react";
import { MetaFormLabel } from "@/app/components/meta/MetaFormLabel";
import MetaCountryPicker from "@/app/components/meta/MetaCountryPicker";
import MetaSearchablePicker from "@/app/components/meta/MetaSearchablePicker";
import {
  META_PUBLISHER_PLATFORMS,
  META_SALES_CONVERSION_EVENTS,
  META_PIXEL_CONVERSION_EVENTS,
  META_LEADS_CAMPAIGN_CONVERSION_PICKER_EVENTS,
  META_GENDER_OPTIONS,
  getOptimizationGoalsForObjective,
  getDefaultGoalForObjective,
  isMetaLeadsWebsiteConversionEvent,
} from "@/lib/meta-ads-constants";

type Pixel = { id: string; name: string };

export type MetaAdSetFormBody = {
  name: string;
  daily_budget: number;
  /** Países do público (API: geo_locations.countries). */
  country_codes: string[];
  /** @deprecated use country_codes; mantido para compat. */
  country_code?: string;
  age_min: number;
  age_max: number;
  gender: "all" | "male" | "female";
  optimization_goal: string;
  pixel_id?: string;
  conversion_event?: string;
  publisher_platforms: string[];
};

type Props = {
  campaignId: string;
  adAccountId: string;
  campaignName?: string;
  defaultName?: string;
  defaultBudget?: string;
  /** Lista de países (ex.: edição de conjunto com vários países). */
  defaultCountryCodes?: string[];
  defaultCountry?: string;
  defaultAgeMin?: string;
  defaultAgeMax?: string;
  defaultGender?: "all" | "male" | "female";
  defaultOptimizationGoal?: string;
  defaultPixelId?: string;
  defaultConversionEvent?: string;
  defaultPublisherPlatforms?: string[];
  submitLabel?: string;
  onSubmit: (body: MetaAdSetFormBody) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
};

function platformsRecordFromList(list?: string[]) {
  const set = new Set((list?.length ? list : ["facebook", "instagram"]).map((x) => String(x).toLowerCase()));
  return Object.fromEntries(META_PUBLISHER_PLATFORMS.map((p) => [p.value, set.has(p.value)])) as Record<string, boolean>;
}

export default function MetaAdSetForm({
  campaignId,
  adAccountId,
  campaignName,
  defaultName = "",
  defaultBudget = "10",
  defaultCountryCodes,
  defaultCountry = "BR",
  defaultAgeMin = "18",
  defaultAgeMax = "65",
  defaultGender = "all",
  defaultOptimizationGoal = "LINK_CLICKS",
  defaultPixelId = "",
  defaultConversionEvent = "PURCHASE",
  defaultPublisherPlatforms,
  submitLabel,
  onSubmit,
  onCancel,
  saving,
  error,
}: Props) {
  const [name, setName] = useState(defaultName);
  const [dailyBudget, setDailyBudget] = useState(defaultBudget);
  const [countryCodes, setCountryCodes] = useState<string[]>(() =>
    defaultCountryCodes?.length ? [...new Set(defaultCountryCodes.map((c) => String(c).toUpperCase().slice(0, 2)))].filter((c) => c.length === 2)
      : [defaultCountry]
  );
  const [ageMin, setAgeMin] = useState(defaultAgeMin);
  const [ageMax, setAgeMax] = useState(defaultAgeMax);
  const [gender, setGender] = useState<"all" | "male" | "female">(defaultGender);
  const [optimizationGoal, setOptimizationGoal] = useState(defaultOptimizationGoal);
  const [pixelId, setPixelId] = useState(defaultPixelId);
  const [conversionEvent, setConversionEvent] = useState(
    defaultConversionEvent || (defaultOptimizationGoal === "OFFSITE_CONVERSIONS" ? "PURCHASE" : "PURCHASE")
  );
  const [publisherPlatforms, setPublisherPlatforms] = useState<Record<string, boolean>>(() =>
    platformsRecordFromList(defaultPublisherPlatforms)
  );
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [campaignObjective, setCampaignObjective] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    fetch(`/api/meta/campaigns?campaign_id=${encodeURIComponent(campaignId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && !json.error) setCampaignObjective((json.objective ?? "OUTCOME_TRAFFIC").toUpperCase());
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [campaignId]);

  const isSales = campaignObjective === "OUTCOME_SALES";
  const isLeads = campaignObjective === "OUTCOME_LEADS";
  const allowedGoals = getOptimizationGoalsForObjective(campaignObjective ?? "OUTCOME_TRAFFIC");
  const goalOk = isSales || allowedGoals.some((o) => o.value === optimizationGoal);

  const pixelPickerOptions = useMemo(
    () => pixels.map((p) => ({ value: p.id, label: p.name || "Pixel", description: p.id })),
    [pixels]
  );
  const salesConversionPickerOptions = useMemo(
    () => META_SALES_CONVERSION_EVENTS.map((o) => ({ value: o.value, label: o.label })),
    []
  );
  const pixelConversionPickerOptions = useMemo(() => {
    const src = isLeads ? META_LEADS_CAMPAIGN_CONVERSION_PICKER_EVENTS : META_PIXEL_CONVERSION_EVENTS;
    return src.map((o) => ({ value: o.value, label: o.label }));
  }, [isLeads]);
  const optimizationGoalPickerOptions = useMemo(
    () => allowedGoals.map((o) => ({ value: o.value, label: o.label })),
    [allowedGoals]
  );
  const genderPickerOptions = useMemo(
    () => META_GENDER_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    []
  );

  const displayOptimizationGoal = goalOk ? optimizationGoal : getDefaultGoalForObjective(campaignObjective ?? "OUTCOME_TRAFFIC");

  const handleOptimizationGoalPick = useCallback((v: string) => {
    setOptimizationGoal(v);
    if (!["OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"].includes(v)) {
      setPixelId("");
      setConversionEvent("PURCHASE");
    } else {
      setConversionEvent((prev) => {
        if (campaignObjective === "OUTCOME_LEADS") {
          return isMetaLeadsWebsiteConversionEvent(prev) ? prev : "LEAD";
        }
        return "PURCHASE";
      });
    }
  }, [campaignObjective]);

  useEffect(() => {
    if (campaignObjective == null) return;
    if (isSales) {
      setOptimizationGoal("OFFSITE_CONVERSIONS");
      setConversionEvent((e) => (e === "ADD_TO_CART" || e === "PURCHASE" ? e : "PURCHASE"));
      return;
    }
    const convGoals = ["OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"];
    if (isLeads && convGoals.includes(optimizationGoal)) {
      setConversionEvent((e) => (isMetaLeadsWebsiteConversionEvent(e) ? e : "LEAD"));
      return;
    }
    const allowed = getOptimizationGoalsForObjective(campaignObjective);
    if (!allowed.some((o) => o.value === optimizationGoal)) {
      setOptimizationGoal(getDefaultGoalForObjective(campaignObjective));
      setPixelId("");
      setConversionEvent("PURCHASE");
    }
  }, [campaignObjective, isSales, isLeads, optimizationGoal]);

  useEffect(() => {
    if (!adAccountId) return;
    let cancelled = false;
    fetch(`/api/meta/pixels?ad_account_id=${encodeURIComponent(adAccountId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.pixels) setPixels(json.pixels);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [adAccountId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const budgetCents = Math.round(parseFloat(dailyBudget || "0") * 100);
    if (budgetCents < 100) return;
    const pubList = META_PUBLISHER_PLATFORMS.map((p) => p.value).filter((p) => publisherPlatforms[p]);
    if (pubList.length === 0) return;
    if (isSales && (!pixelId.trim() || !["PURCHASE", "ADD_TO_CART"].includes(conversionEvent))) return;
    const convGoals = ["OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"];
    if (
      isLeads &&
      convGoals.includes(optimizationGoal) &&
      (!pixelId.trim() || !isMetaLeadsWebsiteConversionEvent(conversionEvent))
    ) {
      return;
    }
    const codes = countryCodes.length > 0 ? countryCodes : ["BR"];
    onSubmit({
      name: name.trim(),
      daily_budget: budgetCents,
      country_codes: codes,
      country_code: codes[0],
      age_min: parseInt(ageMin, 10) || 18,
      age_max: parseInt(ageMax, 10) || 65,
      gender,
      optimization_goal: isSales ? "OFFSITE_CONVERSIONS" : optimizationGoal,
      pixel_id: pixelId.trim() || undefined,
      conversion_event: isSales
        ? conversionEvent
        : pixelId.trim()
          ? conversionEvent || undefined
          : undefined,
      publisher_platforms: pubList,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 md:space-y-2.5 flex flex-col flex-1 min-h-0">
      <div className="flex items-start gap-2">
        <h3 className="text-base md:text-lg font-semibold text-text-primary flex items-center gap-2 min-w-0 flex-1">
          <Target className="h-5 w-5 text-shopee-orange shrink-0" />
          <span>Conjunto de anúncios</span>
          <span
            className="inline-flex shrink-0"
            title="Orçamento, público, plataformas (Facebook, Instagram, etc.) e otimização conforme o objetivo da campanha."
            aria-label="Ajuda sobre o conjunto"
          >
            <HelpCircle className="h-4 w-4 text-text-secondary/45 hover:text-shopee-orange cursor-help" />
          </span>
        </h3>
      </div>
      {campaignName && (
        <p className="text-xs md:text-sm text-text-secondary">
          Campanha: <strong className="text-text-primary">{campaignName}</strong>
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 md:gap-4 gap-3">
        <div>
          <MetaFormLabel htmlFor="adset-name">Nome do conjunto</MetaFormLabel>
          <input
            id="adset-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Conjunto BR 18-45"
            className="w-full rounded-md border border-dark-border bg-dark-bg py-1.5 md:py-2 px-3 text-text-primary text-sm placeholder-text-secondary/60"
          />
        </div>
        <div>
          <MetaFormLabel
            htmlFor="adset-budget"
            hint="Mínimo R$ 1,00. Ex.: 10 = R$ 10 por dia."
          >
            Orçamento diário (R$)
          </MetaFormLabel>
          <input
            id="adset-budget"
            type="number"
            min="1"
            step="0.01"
            value={dailyBudget}
            onChange={(e) => setDailyBudget(e.target.value)}
            className="w-full rounded-md border border-dark-border bg-dark-bg py-1.5 md:py-2 px-3 text-text-primary text-sm"
          />
        </div>
      </div>

      {campaignObjective == null ? (
        <p className="text-sm text-text-secondary flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando objetivo da campanha…
        </p>
      ) : isSales ? (
        <>
          <div className="rounded-lg border border-dark-border/60 bg-dark-bg/20 p-2.5 md:p-3 space-y-2">
            <div>
              <MetaFormLabel
                htmlFor="adset-pixel-sales-open"
                hint="Campanha de vendas: otimização para compras ou carrinho no site. Pixel obrigatório."
              >
                Pixel
              </MetaFormLabel>
              <MetaSearchablePicker
                value={pixelId}
                onChange={setPixelId}
                options={pixelPickerOptions}
                modalTitle="Pixel"
                searchPlaceholder="Filtrar pixels…"
                emptyButtonLabel="Buscar e selecionar pixel"
                emptyOptionsMessage="Nenhum pixel nesta conta."
                openButtonId="adset-pixel-sales-open"
              />
            </div>
            <div>
              <MetaFormLabel htmlFor="adset-conv-sales-open">Evento para otimizar</MetaFormLabel>
              <MetaSearchablePicker
                value={conversionEvent}
                onChange={setConversionEvent}
                options={salesConversionPickerOptions}
                modalTitle="Evento para otimizar"
                searchPlaceholder="Filtrar…"
                emptyButtonLabel="Escolher evento"
                openButtonId="adset-conv-sales-open"
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Meta de desempenho</label>
            <MetaSearchablePicker
              value={displayOptimizationGoal}
              onChange={handleOptimizationGoalPick}
              options={optimizationGoalPickerOptions}
              modalTitle="Meta de desempenho"
              searchPlaceholder="Filtrar metas…"
              emptyButtonLabel="Escolher meta"
            />
          </div>
          {["OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"].includes(
            goalOk ? optimizationGoal : getDefaultGoalForObjective(campaignObjective ?? "OUTCOME_TRAFFIC")
          ) && (
            <>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Conjunto de dados (Pixel)</label>
                <MetaSearchablePicker
                  value={pixelId}
                  onChange={setPixelId}
                  options={pixelPickerOptions}
                  modalTitle="Conjunto de dados (Pixel)"
                  searchPlaceholder="Filtrar pixels…"
                  emptyButtonLabel="Buscar pixel"
                  emptyAsTag
                  emptyTagLabel="Nenhum"
                  allowClear
                  clearLabel="Nenhum"
                  emptyOptionsMessage="Nenhum pixel nesta conta."
                />
              </div>
              {pixelId ? (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Evento de conversão</label>
                  <MetaSearchablePicker
                    value={conversionEvent}
                    onChange={setConversionEvent}
                    options={pixelConversionPickerOptions}
                    modalTitle="Evento de conversão"
                    searchPlaceholder="Filtrar eventos…"
                    emptyButtonLabel="Escolher evento"
                  />
                </div>
              ) : null}
            </>
          )}
        </>
      )}

      <div className="rounded-lg border border-dark-border/60 bg-dark-bg/20 p-2.5 md:p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <Zap className="h-4 w-4 text-shopee-orange shrink-0" /> Plataformas
        </div>
        <div className="grid grid-cols-2 gap-2">
          {META_PUBLISHER_PLATFORMS.map((p) => (
            <label key={p.value} className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(publisherPlatforms[p.value])}
                onChange={() => setPublisherPlatforms((prev) => ({ ...prev, [p.value]: !prev[p.value] }))}
                className="rounded border-dark-border"
              />
              {p.label}
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPublisherPlatforms(Object.fromEntries(META_PUBLISHER_PLATFORMS.map((x) => [x.value, true])))}
          className="text-xs text-shopee-orange hover:underline"
        >
          Marcar todas
        </button>
      </div>

      <div className="rounded-lg border border-dark-border/60 bg-dark-bg/20 p-2.5 md:p-3 space-y-2">
        <MetaFormLabel
          htmlFor="adset-countries-open"
          hint="Pesquise no modal, marque os países e confirme. Eles aparecem como tags laranja, no mesmo espírito das plataformas."
        >
          Países (público)
        </MetaFormLabel>
        <p className="text-[11px] text-text-secondary/80 -mt-1 mb-1">
          Mínimo 1, máximo 25. Use o botão para abrir a busca e escolher vários países.
        </p>
        <MetaCountryPicker
          value={countryCodes}
          onChange={setCountryCodes}
          max={25}
          openButtonId="adset-countries-open"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-2 md:items-end">
        <div className="md:col-span-6">
          <MetaFormLabel htmlFor="adset-gender-open">Gênero</MetaFormLabel>
          <MetaSearchablePicker
            value={gender}
            onChange={(v) => setGender(v as "all" | "male" | "female")}
            options={genderPickerOptions}
            modalTitle="Gênero do público"
            searchPlaceholder="Filtrar…"
            emptyButtonLabel="Escolher gênero"
            openButtonId="adset-gender-open"
          />
        </div>
        <div className="md:col-span-6 flex gap-2">
          <div className="flex-1 min-w-0">
            <MetaFormLabel htmlFor="adset-age-min">Idade mín.</MetaFormLabel>
            <input
              id="adset-age-min"
              type="number"
              min="18"
              max="65"
              value={ageMin}
              onChange={(e) => setAgeMin(e.target.value)}
              className="w-full rounded-md border border-dark-border bg-dark-bg py-1.5 md:py-2 px-2 text-text-primary text-sm"
            />
          </div>
          <div className="flex-1 min-w-0">
            <MetaFormLabel htmlFor="adset-age-max">Idade máx.</MetaFormLabel>
            <input
              id="adset-age-max"
              type="number"
              min="18"
              max="65"
              value={ageMax}
              onChange={(e) => setAgeMax(e.target.value)}
              className="w-full rounded-md border border-dark-border bg-dark-bg py-1.5 md:py-2 px-2 text-text-primary text-sm"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
      )}
      <div className="flex gap-3 pt-2 md:pt-1.5 border-t border-dark-border/50 mt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-dark-border px-3 py-1.5 md:px-4 md:py-2 text-sm font-medium text-text-primary hover:bg-dark-bg"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!name.trim() || saving || campaignObjective == null}
          className="flex items-center gap-2 rounded-md bg-shopee-orange px-3 py-1.5 md:px-4 md:py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitLabel ?? "Criar conjunto"}
        </button>
      </div>
    </form>
  );
}
