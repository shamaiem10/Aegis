export type ResourceKind =
  | "medical"
  | "security"
  | "rescue_water"
  | "shelter"
  | "utility"
  | "power_mobile"
  | "drone"
  | "fire"
  | "ngo";

export interface ResourceUnit {
  resource_id: string;
  name: string;
  kind: ResourceKind;
  agency: string;
  quantity_available: number;
  quantity_total: number;
  lat: number;
  lon: number;
  tags: string[];
  min_tier: number;
  source: "curated" | "openstreetmap";
  osm_id?: string;
  status?: "available" | "deployed" | "limited";
}

/** Mobile Resources tab row (aggregated pool). */
export interface ResourcePoolItem {
  type: string;
  icon: string;
  total: number;
  deployed: number;
  healthImpact?: string;
  assigned?: { crisisId: string; eta: string }[];
}

export interface InventoryPayload {
  region: string;
  updatedAt: string;
  units: ResourceUnit[];
  items: ResourcePoolItem[];
  sources: { curated: number; openstreetmap: number };
  bbox: { south: number; west: number; north: number; east: number };
}
