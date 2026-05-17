import { safeFirestoreWrite } from "../utils/safeFirestore";
import { db } from "../firebase-admin";
import { sanitizeForFirestore } from "../utils/sanitizeFirestore";
import type { ResourceUnitRow, ResourceInventoryBundle } from "../apis/resourceInventoryClient";
import { fetchRemoteResourceInventory } from "../apis/resourceInventoryClient";
import { materializePkMockCrisisIfMissing } from "./crisisMaterialize";

export type CrisisAllocationUnit = {
  resource_id: string;
  name: string;
  kind?: string;
  agency?: string;
  quantity_available: number;
  quantity_total?: number;
};

export type CrisisDossierShape = {
  crisis_id: string;
  status: string;
  allocation: { units: CrisisAllocationUnit[]; notes: string };
  [key: string]: unknown;
};

export type ResourceAssignment = {
  resource_id: string;
  quantity: number;
};

const INVENTORY_DOC = "resources/inventory";

function unwrapDossier(data: Record<string, unknown> | undefined): CrisisDossierShape | null {
  if (!data) return null;
  if (data.dossier && typeof data.dossier === "object") {
    return data.dossier as CrisisDossierShape;
  }
  if (typeof data.crisis_id === "string") {
    return data as CrisisDossierShape;
  }
  return null;
}

async function loadInventory(): Promise<ResourceInventoryBundle> {
  const snap = await db.doc(INVENTORY_DOC).get();
  if (snap.exists) {
    const row = snap.data() as ResourceInventoryBundle;
    if (Array.isArray(row.units) && row.units.length > 0) {
      return row;
    }
  }
  return fetchRemoteResourceInventory(false);
}

async function saveInventory(bundle: ResourceInventoryBundle): Promise<void> {
  const payload = sanitizeForFirestore({
    region: bundle.region,
    units: bundle.units,
    items: bundle.items ?? [],
    sources: bundle.sources,
    updatedAt: new Date().toISOString(),
  });
  await safeFirestoreWrite(INVENTORY_DOC, () =>
    db.doc(INVENTORY_DOC).set(payload, { merge: true }),
  );
}

async function loadCrisisDoc(
  crisisId: string,
): Promise<{ dossier: CrisisDossierShape; raw: Record<string, unknown> }> {
  const ref = db.collection("crises").doc(crisisId);
  let doc = await ref.get();

  if (!doc.exists) {
    const materialized = await materializePkMockCrisisIfMissing(crisisId);
    if (!materialized) {
      throw new Error("crisis_not_found");
    }
    return materialized;
  }

  const raw = doc.data() as Record<string, unknown>;
  let dossier = unwrapDossier(raw);
  if (!dossier) {
    throw new Error("unrecognized_crisis_shape");
  }
  if (!dossier.allocation) {
    dossier.allocation = { units: [], notes: "" };
  }
  return { dossier, raw };
}

async function saveCrisisDoc(
  crisisId: string,
  dossier: CrisisDossierShape,
  raw: Record<string, unknown>,
): Promise<void> {
  const payload =
    raw.dossier && typeof raw.dossier === "object"
      ? { ...raw, dossier, status: dossier.status, updated_at: new Date().toISOString() }
      : { ...raw, ...dossier, status: dossier.status, updated_at: new Date().toISOString() };

  await safeFirestoreWrite(`crises/${crisisId}`, () =>
    db.collection("crises").doc(crisisId).set(sanitizeForFirestore(payload), { merge: true }),
  );
}

function returnToInventory(
  inventory: ResourceInventoryBundle,
  resourceId: string,
  quantity: number,
): void {
  const qty = Math.max(0, Math.floor(quantity));
  if (qty <= 0) return;
  const unit = inventory.units.find((u) => u.resource_id === resourceId);
  if (!unit) return;
  const cap = unit.quantity_total ?? unit.quantity_available + qty;
  unit.quantity_available = Math.min(unit.quantity_available + qty, cap);
}

function releaseAllocationOnInventory(
  inventory: ResourceInventoryBundle,
  dossier: CrisisDossierShape,
): number {
  let released = 0;
  for (const a of dossier.allocation?.units ?? []) {
    const qty = Number(a.quantity_available) || 0;
    if (qty <= 0) continue;
    returnToInventory(inventory, a.resource_id, qty);
    released += qty;
  }
  dossier.allocation = {
    units: [],
    notes: `Resources released at ${new Date().toISOString()}`,
  };
  return released;
}

export async function applyCrisisResourceAllocations(
  crisisId: string,
  assignments: ResourceAssignment[],
): Promise<{ dossier: CrisisDossierShape; inventory: ResourceInventoryBundle }> {
  const { dossier, raw } = await loadCrisisDoc(crisisId);
  const inventory = await loadInventory();

  releaseAllocationOnInventory(inventory, dossier);

  const newUnits: CrisisAllocationUnit[] = [];
  const seen = new Set<string>();

  for (const row of assignments) {
    const resource_id = String(row.resource_id ?? "").trim();
    const quantity = Math.max(0, Math.floor(Number(row.quantity) || 0));
    if (!resource_id || quantity <= 0) continue;
    if (seen.has(resource_id)) {
      throw new Error(`duplicate_resource:${resource_id}`);
    }
    seen.add(resource_id);

    const inv = inventory.units.find((u) => u.resource_id === resource_id);
    if (!inv) {
      throw new Error(`unknown_resource:${resource_id}`);
    }
    if (inv.quantity_available < quantity) {
      throw new Error(
        `insufficient:${resource_id}:${inv.quantity_available}:${quantity}`,
      );
    }
    inv.quantity_available -= quantity;
    newUnits.push({
      resource_id: inv.resource_id,
      name: inv.name,
      kind: inv.kind,
      agency: inv.agency,
      quantity_available: quantity,
      quantity_total: quantity,
    });
  }

  dossier.allocation = {
    units: newUnits,
    notes:
      newUnits.length > 0
        ? `Committed ${newUnits.reduce((s, u) => s + u.quantity_available, 0)} units across ${newUnits.length} assets`
        : "No resources committed",
  };

  await saveInventory(inventory);
  await saveCrisisDoc(crisisId, dossier, raw);

  return { dossier, inventory };
}

export async function releaseCrisisResources(
  crisisId: string,
): Promise<{ dossier: CrisisDossierShape; releasedUnits: number }> {
  const { dossier, raw } = await loadCrisisDoc(crisisId);
  const inventory = await loadInventory();
  const released = releaseAllocationOnInventory(inventory, dossier);
  await saveInventory(inventory);
  await saveCrisisDoc(crisisId, dossier, raw);
  return { dossier, releasedUnits: released };
}

export async function patchCrisisStatusWithRelease(
  crisisId: string,
  status: string,
): Promise<CrisisDossierShape> {
  const { dossier, raw } = await loadCrisisDoc(crisisId);
  const inventory = await loadInventory();

  if (
    (status === "resolved" || status === "false_alarm") &&
    dossier.status !== status &&
    (dossier.allocation?.units?.length ?? 0) > 0
  ) {
    releaseAllocationOnInventory(inventory, dossier);
    await saveInventory(inventory);
  }

  dossier.status = status;
  await saveCrisisDoc(crisisId, dossier, raw);
  return dossier;
}
