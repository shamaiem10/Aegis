import { Ionicons } from "@expo/vector-icons";

import { getCrisisTypeConfig } from "../constants/crisisTypes";

export type IonName = keyof typeof Ionicons.glyphMap;

/** Icon from `crisisTypeConfig` when payload carries crisis type label. */
export function alertIconForCrisisType(typeLabel: string): IonName {
  return getCrisisTypeConfig(typeLabel).icon as IonName;
}

/** Map signal text/kind to a consistent Ionicon for list tiles. */
export function alertIconForSignal(kind: string, text: string): IonName {
  const k = `${kind} ${text}`.toLowerCase();
  if (/pm2\.5|pm10|aqi|pepa|air quality|smog/.test(k)) return "leaf-outline";
  if (/dust storm|pmd|visibility/.test(k)) return "cloud-outline";
  if (/heat|heatwave|humidity|heat index/.test(k)) return "thermometer-outline";
  if (/power|iesco|outage|grid/.test(k)) return "flash-outline";
  if (k.includes("flood") || k.includes("water")) return "water-outline";
  if (k.includes("fire") || k.includes("smoke")) return "flame-outline";
  if (/collision|crash|accident|vehicular|highway/.test(k)) return "car-outline";
  if (k.includes("traffic") || k.includes("road")) return "bus-outline";
  if (k.includes("quake") || k.includes("seismic")) return "earth-outline";
  if (/hospital|respiratory|pims/.test(k)) return "medkit-outline";
  if (/satellite|imagery|stack/.test(k)) return "globe-outline";
  return "cellular-outline";
}
