from __future__ import annotations

from itertools import product

from models.schemas import (
    ClassificationResult,
    ResourceAllocation,
    ResourceUnit,
    SeverityResult,
)
from tools.mock_data_io import load_json
from utils.geo import haversine_km


def _tier(severity: SeverityResult) -> int:
    return 3 if severity.score >= 8 else 2 if severity.score >= 5 else 1


def _pool_candidates(
    centroid_lat: float,
    centroid_lon: float,
    classification: ClassificationResult,
    severity: SeverityResult,
    *,
    inventory_file: str,
    qty_budget_max: int | None = None,
) -> tuple[int, int, list[dict]]:
    data = load_json(inventory_file)
    if not isinstance(data, dict) or "units" not in data:
        return -1, 0, []
    raw_units = data["units"]
    tier = _tier(severity)
    qty_budget = tier * 2 if qty_budget_max is None else max(1, min(qty_budget_max, tier * 4))

    pooled: list[dict] = []
    for row in raw_units:
        tags = set(row.get("tags") or []) | {"all"}
        if classification.category.value not in tags:
            continue
        eligible = tier >= int(row.get("min_tier", 1))
        if not eligible:
            continue
        dist = haversine_km(
            centroid_lat,
            centroid_lon,
            float(row["lat"]),
            float(row["lon"]),
        )
        pooled.append({"row": row, "distance_km": dist})

    pooled.sort(key=lambda item: item["distance_km"])
    return tier, qty_budget, pooled


def allocate_resources(
    centroid_lat: float,
    centroid_lon: float,
    classification: ClassificationResult,
    severity: SeverityResult,
    *,
    inventory_file: str = "resource_inventory.json",
    qty_budget_max: int | None = None,
) -> ResourceAllocation:
    tier, qty_budget, pooled = _pool_candidates(
        centroid_lat,
        centroid_lon,
        classification,
        severity,
        inventory_file=inventory_file,
        qty_budget_max=qty_budget_max,
    )
    if tier < 0:
        return ResourceAllocation(units=[], notes="Inventory malformed.")

    selected: list[ResourceUnit] = []
    notes_parts = [f"tier={tier}", f"picked nearest within {classification.category.value} tags"]
    budget_left = qty_budget

    for item in pooled:
        if budget_left <= 0:
            break
        row = item["row"]
        take = min(int(row.get("quantity_available", 0)), budget_left, 6)
        if take <= 0:
            continue
        eta = int(item["distance_km"] / 35 * 60)
        selected.append(
            ResourceUnit(
                resource_id=str(row["resource_id"]),
                name=str(row["name"]),
                kind=str(row.get("kind", "generic")),
                quantity_available=take,
                lat=float(row["lat"]),
                lon=float(row["lon"]),
                eta_minutes_estimate=eta,
            )
        )
        budget_left -= take

    return ResourceAllocation(
        units=selected,
        notes="; ".join(notes_parts) + f"; deployed {len(selected)} unit bundles.",
    )


def allocate_resources_optimized(
    centroid_lat: float,
    centroid_lon: float,
    classification: ClassificationResult,
    severity: SeverityResult,
    *,
    inventory_file: str = "resource_inventory.json",
    qty_budget_max: int | None = None,
) -> ResourceAllocation:
    """Bounded discrete surrogate: maximize weighted coverage − ETA penalty over unit counts."""
    tier, budget, pooled = _pool_candidates(
        centroid_lat,
        centroid_lon,
        classification,
        severity,
        inventory_file=inventory_file,
        qty_budget_max=qty_budget_max,
    )
    if tier < 0:
        return ResourceAllocation(units=[], notes="Inventory malformed.")

    n = min(5, len(pooled))
    items = pooled[:n]
    if not items:
        return ResourceAllocation(units=[], notes=f"tier={tier}; no eligible units for discrete optimizer.")

    caps = [
        min(6, int(it["row"].get("quantity_available", 0)), budget)
        for it in items
    ]
    ranges = [range(0, c + 1) for c in caps]
    best_obj = -1e18
    best_takes: tuple[int, ...] | None = None

    sev = float(severity.score)
    for takes in product(*ranges):
        total = sum(takes)
        if total == 0 or total > budget:
            continue
        obj = 0.0
        for j, t in enumerate(takes):
            if t == 0:
                continue
            dist = items[j]["distance_km"]
            eta = int(dist / 35 * 60)
            obj += t * sev / (1.0 + dist / 40.0) + t * max(0.0, 4.0 - eta / 25.0) * 0.08
        if obj > best_obj:
            best_obj = obj
            best_takes = takes

    if best_takes is None:
        return allocate_resources(
            centroid_lat,
            centroid_lon,
            classification,
            severity,
            inventory_file=inventory_file,
            qty_budget_max=qty_budget_max,
        )

    selected: list[ResourceUnit] = []
    for j, t in enumerate(best_takes):
        if t == 0:
            continue
        row = items[j]["row"]
        dist = items[j]["distance_km"]
        eta = int(dist / 35 * 60)
        selected.append(
            ResourceUnit(
                resource_id=str(row["resource_id"]),
                name=str(row["name"]),
                kind=str(row.get("kind", "generic")),
                quantity_available=t,
                lat=float(row["lat"]),
                lon=float(row["lon"]),
                eta_minutes_estimate=eta,
            )
        )

    return ResourceAllocation(
        units=selected,
        notes=(
            f"tier={tier}; discrete_surrogate_opt objective≈{best_obj:.2f} "
            f"(impact/urgency vs travel friction); {len(selected)} unit row(s)."
        ),
    )


def allocate_resources_multi(
    incidents: list[tuple[float, float, ClassificationResult, SeverityResult]],
    *,
    inventory_file: str = "resource_inventory.json",
    shared_cap: int = 16,
    use_discrete_optimizer: bool = True,
) -> tuple[ResourceAllocation, str]:
    """Share a global deployment budget across simultaneous incidents (trade-offs)."""
    if not incidents:
        return ResourceAllocation(units=[], notes="No incidents."), ""

    _alloc = allocate_resources_optimized if use_discrete_optimizer else allocate_resources

    ranked = sorted(incidents, key=lambda x: x[3].score, reverse=True)
    remaining = shared_cap
    all_units: list[ResourceUnit] = []
    trade_bits: list[str] = []

    for i, (lat, lon, cls, sev) in enumerate(ranked):
        slots = max(2, shared_cap // max(2, len(ranked)))
        if i == 0:
            share = min(remaining, slots + 2, max(3, sev.score))
        else:
            share = min(remaining, slots)
        if share <= 0:
            trade_bits.append(
                f"Deferred supplemental assets for `{cls.category.value}` "
                f"(remaining budget {remaining}) — prioritize higher-severity node."
            )
            continue
        part = _alloc(lat, lon, cls, sev, inventory_file=inventory_file, qty_budget_max=share)
        deployed = sum(u.quantity_available for u in part.units)
        remaining = max(0, remaining - deployed)
        all_units.extend(part.units)
        trade_bits.append(f"{cls.category.value}@({lat:.3f},{lon:.3f}) sev={sev.score} → {deployed} slots")

    notes = (
        f"Multi-incident shared cap={shared_cap}; remaining_budget≈{remaining}. "
        + " | ".join(trade_bits)
    )
    return ResourceAllocation(units=all_units, notes=notes), (
        "Prioritization: highest severity draws nearest-fastest units first; "
        "secondary incident receives trimmed slots to preserve minimum EMS coverage."
    )
