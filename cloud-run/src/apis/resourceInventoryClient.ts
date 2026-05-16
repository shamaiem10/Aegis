import fetch from "node-fetch";

import { safeFirestoreWrite } from "../utils/safeFirestore";
import { db } from "../firebase-admin";
import { sanitizeForFirestore } from "../utils/sanitizeFirestore";

export type ResourceUnitRow = {
  resource_id: string;
  name: string;
  kind: string;
  agency?: string;
  quantity_available: number;
  quantity_total?: number;
  lat: number;
  lon: number;
  tags?: string[];
  source?: string;
};

export type ResourceInventoryBundle = {
  region: string;
  updatedAt: string;
  units: ResourceUnitRow[];
  items: unknown[];
  sources?: { curated: number; openstreetmap: number };
};

const FALLBACK_UNITS: ResourceUnitRow[] = [
  {
    resource_id: "isb_rescue_1122_alpha",
    name: "Rescue 1122 — Islamabad",
    kind: "rescue_water",
    agency: "Rescue 1122",
    quantity_available: 12,
    quantity_total: 16,
    lat: 33.6844,
    lon: 73.0479,
    tags: ["all", "flood"],
    source: "fallback",
  },
  {
    resource_id: "isb_ems_central",
    name: "PIMS EMS staging",
    kind: "medical",
    agency: "PIMS",
    quantity_available: 18,
    quantity_total: 22,
    lat: 33.7069,
    lon: 73.0557,
    tags: ["all"],
    source: "fallback",
  },
  {
    resource_id: "isb_traffic_cell",
    name: "ICT Police traffic cell",
    kind: "security",
    agency: "ICT Police",
    quantity_available: 40,
    quantity_total: 48,
    lat: 33.6935,
    lon: 73.0652,
    tags: ["all"],
    source: "fallback",
  },
];

function inventoryBaseUrl(): string | null {
  const u =
    process.env.PK_RESOURCES_INVENTORY_URL?.trim() ||
    process.env.EXPO_PUBLIC_PK_RESOURCES_URL?.trim();
  return u ? u.replace(/\/$/, "") : null;
}

export async function fetchRemoteResourceInventory(
  refresh = false,
): Promise<ResourceInventoryBundle> {
  const base = inventoryBaseUrl();
  if (!base) {
    return {
      region: "fallback",
      updatedAt: new Date().toISOString(),
      units: FALLBACK_UNITS,
      items: [],
    };
  }

  const q = refresh ? "?refresh=1" : "";
  const url = `${base}/api/v1/resources/inventory/islamabad${q}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
    const body = (await res.json()) as {
      success?: boolean;
      data?: ResourceInventoryBundle;
      error?: string;
    };
    if (!res.ok || !body.success || !body.data?.units?.length) {
      throw new Error(body.error ?? `inventory HTTP ${res.status}`);
    }
    return body.data;
  } catch (e) {
    console.warn(
      "[resources] Remote inventory failed, using fallback:",
      e instanceof Error ? e.message : e,
    );
    return {
      region: "fallback",
      updatedAt: new Date().toISOString(),
      units: FALLBACK_UNITS,
      items: [],
    };
  }
}

/** Load inventory into Firestore for agents + mobile snapshot listener. */
export async function syncResourceInventoryToFirestore(refresh = false): Promise<ResourceInventoryBundle> {
  const bundle = await fetchRemoteResourceInventory(refresh);
  const payload = sanitizeForFirestore({
    region: bundle.region,
    units: bundle.units,
    items: bundle.items,
    sources: bundle.sources,
    updatedAt: bundle.updatedAt,
  });

  await safeFirestoreWrite("resources/inventory", () =>
    db.doc("resources/inventory").set(payload, { merge: true }),
  );

  return bundle;
}

export function compactUnitsForAgent(units: ResourceUnitRow[], limit = 24): ResourceUnitRow[] {
  return units.slice(0, limit).map((u) => ({
    resource_id: u.resource_id,
    name: String(u.name).slice(0, 80),
    kind: u.kind,
    agency: u.agency,
    quantity_available: u.quantity_available,
    lat: u.lat,
    lon: u.lon,
  }));
}
