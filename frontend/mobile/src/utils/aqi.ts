export type AQIBand = {
  max: number;
  hexLight: string;
  hexDark: string;
  label: string;
};

/** AQI color scale — use `getAQIColor(aqi, darkMode)` everywhere AQI is shown. */
const BANDS: AQIBand[] = [
  { max: 50, hexLight: "#16a34a", hexDark: "#4ade80", label: "Good" },
  { max: 100, hexLight: "#ca8a04", hexDark: "#facc15", label: "Moderate" },
  { max: 150, hexLight: "#ea580c", hexDark: "#fb923c", label: "Unhealthy for Sensitive" },
  { max: 200, hexLight: "#dc2626", hexDark: "#f87171", label: "Unhealthy" },
  { max: 300, hexLight: "#7c3aed", hexDark: "#c084fc", label: "Very Unhealthy" },
  { max: 99999, hexLight: "#7f1d1d", hexDark: "#fca5a5", label: "Hazardous" },
];

export function getAQIColor(aqi: number, dark = false): string {
  const v = Math.max(0, aqi);
  for (const b of BANDS) {
    if (v <= b.max) return dark ? b.hexDark : b.hexLight;
  }
  return dark ? BANDS[BANDS.length - 1].hexDark : BANDS[BANDS.length - 1].hexLight;
}

export function getAQILabel(aqi: number): string {
  const v = Math.max(0, aqi);
  for (const b of BANDS) {
    if (v <= b.max) return b.label;
  }
  return BANDS[BANDS.length - 1].label;
}

export function aqiBand(aqi: number): AQIBand {
  const v = Math.max(0, aqi);
  for (const b of BANDS) {
    if (v <= b.max) return b;
  }
  return BANDS[BANDS.length - 1];
}

/** US EPA AQI from PM2.5 (µg/m³) — matches cloud-run air-quality helper. */
export function calculateAQIFromPm25(pm25: number): number {
  const c = Math.max(0, pm25);
  const segments: { clo: number; chi: number; ilo: number; ihi: number }[] = [
    { clo: 0, chi: 12.0, ilo: 0, ihi: 50 },
    { clo: 12.1, chi: 35.4, ilo: 51, ihi: 100 },
    { clo: 35.5, chi: 55.4, ilo: 101, ihi: 150 },
    { clo: 55.5, chi: 150.4, ilo: 151, ihi: 200 },
    { clo: 150.5, chi: 250.4, ilo: 201, ihi: 300 },
    { clo: 250.5, chi: 350.4, ilo: 301, ihi: 400 },
    { clo: 350.5, chi: 500.4, ilo: 401, ihi: 500 },
  ];
  for (const s of segments) {
    if (c >= s.clo && c <= s.chi) {
      return Math.round(((s.ihi - s.ilo) / (s.chi - s.clo)) * (c - s.clo) + s.ilo);
    }
  }
  if (c > 500.4) return 500;
  return 500;
}

/** Map AQI 0–500 to 0–100 bar width (environmental risk index). */
export function aqiToRiskBarPercent(aqi: number): number {
  return Math.min(100, Math.max(0, Math.round(aqi / 5)));
}
