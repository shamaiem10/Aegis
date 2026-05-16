/** Supplemental signals for rehearsed multi-incident scenarios (G-10 flood + heat, etc.). */

export function getScenarioSupplementalSignals(scenarioId: string): Record<string, unknown>[] {
  const id = scenarioId.toLowerCase().replace(/-/g, "_");
  const now = new Date().toISOString();

  if (id === "g10_flood_heat" || id === "g10" || id === "islamabad_multi") {
    return [
      {
        id: `scenario-g10-flood-${Date.now()}`,
        sourceType: "scenario",
        source: "NDMA-scenario",
        text: "G-10 sector urban flooding — drainage overflow, vehicles stranded near Markaz",
        lat: 33.6702,
        lon: 73.0143,
        region: "G-10 Islamabad",
        severity_hint: 8,
        timestamp: now,
        payload: { mock_category: "floods", sector: "G-10" },
      },
      {
        id: `scenario-i8-heat-${Date.now()}`,
        sourceType: "scenario",
        source: "PMD-scenario",
        text: "I-8 heat stress — feels-like 47°C, humidity 58%, kutchi abadi clusters flagged",
        lat: 33.6598,
        lon: 73.0821,
        region: "I-8 Islamabad",
        severity_hint: 9,
        timestamp: now,
        payload: { mock_category: "heat", temperature_c: 43.2 },
      },
      {
        id: `scenario-f7-aq-${Date.now()}`,
        sourceType: "scenario",
        source: "PEPA-scenario",
        text: "F-7 PM2.5 cluster >150 µg/m³ — Margalla industrial corridor plume suspected",
        lat: 33.7095,
        lon: 73.0421,
        region: "F-7 Islamabad",
        severity_hint: 7,
        timestamp: now,
        payload: { mock_category: "air_quality", pm25: 168 },
      },
      {
        id: `scenario-rwp-dust-${Date.now()}`,
        sourceType: "scenario",
        source: "PMD-scenario",
        text: "Dust corridor approach Rawalpindi — visibility dropping, ETA ~44 min",
        lat: 33.5973,
        lon: 73.0479,
        region: "Rawalpindi",
        severity_hint: 6,
        timestamp: now,
        payload: { mock_category: "dust", visibility_km: 0.9 },
      },
    ];
  }

  return [];
}
