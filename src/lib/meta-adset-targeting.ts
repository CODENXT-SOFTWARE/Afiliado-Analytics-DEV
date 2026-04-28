/**
 * Normaliza o `targeting` antes de enviar à Graph API:
 *
 * 1) `targeting_automation.advantage_audience: 0` — desliga Advantage+ Audience permanentemente.
 *    Decisão de produto: o app nunca usa expansão automática de público. Qualquer valor recebido
 *    (incluindo `1`) é sobrescrito para `0`.
 *
 * 2) `targeting_relaxation_types.lookalike: 0` + `custom_audience: 0` — desliga expansões
 *    automáticas por lookalike e custom audience, também forçado para `0`. Sem isto, em
 *    targeting de 1 país só, o Meta expande geograficamente e dispara subcódigo 3858495
 *    exigindo verificação de anunciante para Taiwan.
 *
 * 3) Exclui Taiwan (TW) e Hong Kong (HK) de `excluded_geo_locations.countries` quando esses
 *    não estão em `geo_locations.countries`. Cinto-suspensório contra a expansão do Meta.
 */
const ALWAYS_EXCLUDED_COUNTRIES = ["TW", "HK"] as const;

export function normalizeAdSetTargeting(targeting: Record<string, unknown>): Record<string, unknown> {
  // 1) advantage_audience — sempre 0
  const raw = targeting.targeting_automation;
  const ta =
    raw && typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  ta.advantage_audience = 0;

  // 2) targeting_relaxation_types — sempre 0
  const rawTrt = targeting.targeting_relaxation_types;
  const trt =
    rawTrt && typeof rawTrt === "object" && rawTrt !== null && !Array.isArray(rawTrt)
      ? { ...(rawTrt as Record<string, unknown>) }
      : {};
  trt.lookalike = 0;
  trt.custom_audience = 0;

  // 3) excluded_geo_locations (TW/HK)
  const geo = targeting.geo_locations;
  const includedCountries =
    geo && typeof geo === "object" && Array.isArray((geo as { countries?: unknown }).countries)
      ? ((geo as { countries: unknown[] }).countries.map((c) => String(c).toUpperCase()))
      : [];
  const toExclude = ALWAYS_EXCLUDED_COUNTRIES.filter((c) => !includedCountries.includes(c));

  let excluded = targeting.excluded_geo_locations;
  if (toExclude.length > 0) {
    const existingExcl =
      excluded && typeof excluded === "object" && !Array.isArray(excluded)
        ? { ...(excluded as Record<string, unknown>) }
        : {};
    const existingCountries = Array.isArray(existingExcl.countries)
      ? (existingExcl.countries as unknown[]).map((c) => String(c).toUpperCase())
      : [];
    existingExcl.countries = [...new Set([...existingCountries, ...toExclude])];
    excluded = existingExcl;
  }

  return {
    ...targeting,
    targeting_automation: ta,
    targeting_relaxation_types: trt,
    ...(excluded ? { excluded_geo_locations: excluded } : {}),
  };
}
