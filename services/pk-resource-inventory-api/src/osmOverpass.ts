import type { ResourceKind, ResourceUnit } from "./types";

const OVERPASS_URL =
  process.env.OVERPASS_URL?.trim() || "https://overpass-api.de/api/interpreter";

export const ISLAMABAD_BBOX = {
  south: 33.5,
  west: 72.82,
  north: 33.86,
  east: 73.22,
};

type OsmElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

let cache: { at: number; units: ResourceUnit[] } | null = null;
const CACHE_MS = Number(process.env.OSM_CACHE_MS) || 6 * 60 * 60 * 1000;

function kindFromTags(tags: Record<string, string>): ResourceKind {
  const amenity = tags.amenity ?? "";
  if (amenity === "police") return "security";
  if (amenity === "fire_station") return "fire";
  if (amenity === "hospital" || amenity === "clinic" || tags.healthcare) return "medical";
  return "medical";
}

function agencyFromTags(tags: Record<string, string>, kind: ResourceKind): string {
  if (tags.operator) return tags.operator.slice(0, 80);
  if (kind === "security") return "ICT Police (OSM)";
  if (kind === "fire") return "Fire service (OSM)";
  return "Healthcare (OSM)";
}

function coords(el: OsmElement): { lat: number; lon: number } | null {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lon: el.lon };
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

function mapElement(el: OsmElement): ResourceUnit | null {
  const tags = el.tags ?? {};
  const name = tags.name ?? tags["name:en"] ?? tags.operator;
  if (!name) return null;
  const c = coords(el);
  if (!c) return null;

  const kind = kindFromTags(tags);
  const id = `osm_${el.type}_${el.id}`;
  const capacity =
    kind === "medical" ? 4 : kind === "security" ? 3 : kind === "fire" ? 2 : 2;

  return {
    resource_id: id,
    name: name.slice(0, 120),
    kind,
    agency: agencyFromTags(tags, kind),
    quantity_available: capacity,
    quantity_total: capacity + 1,
    lat: c.lat,
    lon: c.lon,
    tags: ["all", kind === "medical" ? "accident" : kind === "fire" ? "fire" : "civil_unrest"],
    min_tier: 2,
    source: "openstreetmap",
    osm_id: `${el.type}/${el.id}`,
    status: "available",
  };
}

export async function fetchOsmUnits(
  bbox = ISLAMABAD_BBOX,
  forceRefresh = false,
): Promise<ResourceUnit[]> {
  if (!forceRefresh && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.units;
  }

  const { south, west, north, east } = bbox;
  const query = `
[out:json][timeout:15];
(
  node["amenity"="hospital"](${south},${west},${north},${east});
  node["amenity"="clinic"](${south},${west},${north},${east});
  way["amenity"="hospital"](${south},${west},${north},${east});
  node["amenity"="police"](${south},${west},${north},${east});
  node["amenity"="fire_station"](${south},${west},${north},${east});
);
out center 35;
`;

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(18000),
    });
    if (!res.ok) {
      console.warn("[osm] Overpass HTTP", res.status);
      return cache?.units ?? [];
    }
    const json = (await res.json()) as { elements?: OsmElement[] };
    const units: ResourceUnit[] = [];
    const seen = new Set<string>();
    for (const el of json.elements ?? []) {
      const row = mapElement(el);
      if (!row || seen.has(row.resource_id)) continue;
      seen.add(row.resource_id);
      units.push(row);
    }
    cache = { at: Date.now(), units };
    return units;
  } catch (e) {
    console.warn("[osm] Overpass failed:", e instanceof Error ? e.message : e);
    return cache?.units ?? [];
  }
}
