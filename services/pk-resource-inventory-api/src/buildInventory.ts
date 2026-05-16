import { CURATED_UNITS } from "./baseInventory";
import { ISLAMABAD_BBOX, fetchOsmUnits } from "./osmOverpass";
import type { InventoryPayload, ResourceKind, ResourcePoolItem, ResourceUnit } from "./types";

const KIND_LABEL: Record<ResourceKind, { type: string; icon: string }> = {
  medical: { type: "Ambulances & hospitals", icon: "medkit-outline" },
  security: { type: "Police units", icon: "shield-outline" },
  rescue_water: { type: "Rescue teams", icon: "flame-outline" },
  shelter: { type: "Shelters", icon: "home-outline" },
  utility: { type: "Water tankers", icon: "water-outline" },
  power_mobile: { type: "Generators", icon: "flash-outline" },
  drone: { type: "Drones", icon: "airplane-outline" },
  fire: { type: "Fire & rescue", icon: "flame-outline" },
  ngo: { type: "Field teams", icon: "people-outline" },
};

function aggregateItems(units: ResourceUnit[]): ResourcePoolItem[] {
  const buckets = new Map<string, { total: number; available: number; icon: string }>();

  for (const u of units) {
    const meta = KIND_LABEL[u.kind] ?? { type: u.kind, icon: "cube-outline" };
    const prev = buckets.get(meta.type) ?? { total: 0, available: 0, icon: meta.icon };
    prev.total += u.quantity_total;
    prev.available += u.quantity_available;
    buckets.set(meta.type, prev);
  }

  return [...buckets.entries()].map(([type, b]) => {
    const deployed = Math.max(0, b.total - b.available);
    return {
      type,
      icon: b.icon,
      total: b.total,
      deployed: Math.min(deployed, b.total),
    };
  });
}

export async function buildInventory(options?: {
  enrichOsm?: boolean;
  forceOsmRefresh?: boolean;
}): Promise<InventoryPayload> {
  const enrich = options?.enrichOsm !== false;
  let osmUnits: ResourceUnit[] = [];
  if (enrich) {
    osmUnits = await fetchOsmUnits(ISLAMABAD_BBOX, options?.forceOsmRefresh === true);
  }

  const curatedIds = new Set(CURATED_UNITS.map((u) => u.resource_id));
  const merged = [
    ...CURATED_UNITS,
    ...osmUnits.filter((u) => !curatedIds.has(u.resource_id)),
  ];

  return {
    region: "islamabad_rawalpindi",
    updatedAt: new Date().toISOString(),
    units: merged,
    items: aggregateItems(merged),
    sources: {
      curated: CURATED_UNITS.length,
      openstreetmap: osmUnits.length,
    },
    bbox: ISLAMABAD_BBOX,
  };
}
