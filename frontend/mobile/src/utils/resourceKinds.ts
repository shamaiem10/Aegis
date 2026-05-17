import type { ResourceKindApi } from "../api/types";
import type { IonName } from "./alertIcons";

export type ResourceFilterKey = "all" | ResourceKindApi;

export const RESOURCE_KIND_FILTERS: { key: ResourceFilterKey; label: string; icon: IonName }[] = [
  { key: "all", label: "All", icon: "grid-outline" },
  { key: "medical", label: "Medical", icon: "medkit-outline" },
  { key: "security", label: "Police", icon: "shield-outline" },
  { key: "rescue_water", label: "Rescue", icon: "water-outline" },
  { key: "fire", label: "Fire", icon: "flame-outline" },
  { key: "utility", label: "Utilities", icon: "construct-outline" },
  { key: "shelter", label: "Shelter", icon: "home-outline" },
  { key: "ngo", label: "NGO", icon: "people-outline" },
];

export function kindLabel(kind: ResourceKindApi | undefined): string {
  const row = RESOURCE_KIND_FILTERS.find((f) => f.key === kind);
  return row?.label ?? (kind ? kind.replace(/_/g, " ") : "Other");
}

export function kindIcon(kind: ResourceKindApi | undefined): IonName {
  const row = RESOURCE_KIND_FILTERS.find((f) => f.key === kind);
  return row?.icon ?? "cube-outline";
}
