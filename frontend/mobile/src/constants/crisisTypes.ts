import { Ionicons } from "@expo/vector-icons";

export type CrisisIon = keyof typeof Ionicons.glyphMap;

/** Theme tokens → resolved to hex in `crisisThemeHex` */
export type CrisisThemeKey =
  | "blue"
  | "cyan"
  | "orange"
  | "purple"
  | "amber"
  | "yellow"
  | "red"
  | "gray";

export type CrisisTypeConfigEntry = {
  icon: CrisisIon;
  color: CrisisThemeKey;
  metric: string;
  unit: string;
  risk: string;
};

/** Single source of truth for crisis presentation — add types here only. */
export const crisisTypeConfig: Record<string, CrisisTypeConfigEntry> = {
  "Urban Flooding": {
    icon: "water-outline",
    color: "blue",
    metric: "Rainfall",
    unit: "mm/hr",
    risk: "Flood depth & spread",
  },
  "Infrastructure - Water Main": {
    icon: "build-outline",
    color: "cyan",
    metric: "Pressure Loss",
    unit: "bar",
    risk: "Supply disruption",
  },
  Heatwave: {
    icon: "thermometer-outline",
    color: "orange",
    metric: "Temperature",
    unit: "°C",
    risk: "Heat stress index",
  },
  "Air Quality Emergency": {
    icon: "leaf-outline",
    color: "purple",
    metric: "AQI",
    unit: "AQI",
    risk: "PM2.5 / PM10 levels",
  },
  "Dust Storm": {
    icon: "cloud-outline",
    color: "amber",
    metric: "Visibility",
    unit: "km",
    risk: "Respiratory & transport",
  },
  "Power Outage": {
    icon: "flash-outline",
    color: "yellow",
    metric: "Affected Area",
    unit: "km²",
    risk: "Infrastructure cascade",
  },
  "Disease Cluster": {
    icon: "bug-outline",
    color: "red",
    metric: "Case Count",
    unit: "cases",
    risk: "Spread rate (R value)",
  },
  "Public Disorder": {
    icon: "people-outline",
    color: "gray",
    metric: "Crowd Size",
    unit: "people",
    risk: "Escalation probability",
  },
};

export const crisisTypeKeys = Object.keys(crisisTypeConfig);

export function getCrisisTypeConfig(typeLabel: string): CrisisTypeConfigEntry {
  return crisisTypeConfig[typeLabel] ?? {
    icon: "warning-outline",
    color: "gray",
    metric: "Severity",
    unit: "",
    risk: "Unclassified hazard",
  };
}

/** Hex for light UI; use `crisisThemeHexDark` for dark surfaces. */
export function crisisThemeHex(key: CrisisThemeKey, dark = false): string {
  const light: Record<CrisisThemeKey, string> = {
    blue: "#2563eb",
    cyan: "#0891b2",
    orange: "#ea580c",
    purple: "#7c3aed",
    amber: "#d97706",
    yellow: "#ca8a04",
    red: "#dc2626",
    gray: "#475569",
  };
  const dk: Record<CrisisThemeKey, string> = {
    blue: "#60a5fa",
    cyan: "#22d3ee",
    orange: "#fb923c",
    purple: "#c084fc",
    amber: "#fbbf24",
    yellow: "#facc15",
    red: "#f87171",
    gray: "#94a3b8",
  };
  return dark ? dk[key] : light[key];
}
