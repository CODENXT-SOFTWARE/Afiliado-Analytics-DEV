/**
 * Graph API: ao definir idade/geo customizados, a Meta exige `targeting_automation.advantage_audience` = 0 | 1
 * (erro 100 / subcódigo 1870227). 0 = Advantage+ Audience desligado — respeita faixa etária do anunciante.
 */
export function normalizeAdSetTargeting(targeting: Record<string, unknown>): Record<string, unknown> {
  const raw = targeting.targeting_automation;
  const ta =
    raw && typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  const v = ta.advantage_audience;
  if (v !== 0 && v !== 1) {
    ta.advantage_audience = 0;
  }
  return { ...targeting, targeting_automation: ta };
}
