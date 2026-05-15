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
