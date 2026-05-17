/**
 * Operator resource commitment for a crisis — debits regional inventory.
 */

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  allocateCrisisResources,
  formatAllocationError,
  type ResourceAssignmentApi,
} from "../../api/client";
import type { CrisisDossierApi, ResourceUnitApi } from "../../api/types";
import { useResourceInventory } from "../../../lib/firestore/hooks";
import { kindIcon, kindLabel } from "../../utils/resourceKinds";
import { useAegisUi } from "../../hooks/useAegisUi";
import { Pill } from "./AppShell";

type Props = {
  crisisId: string;
  dossier: CrisisDossierApi;
  disabled?: boolean;
  onSaved: (dossier: CrisisDossierApi) => void;
};

function parseQty(s: string): number {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function CrisisResourceAllocator({ crisisId, dossier, disabled, onSaved }: Props) {
  const { tc, sectionGap, minTouch } = useAegisUi();
  const { units: pool, loading: poolLoading, refresh: refreshPool } = useResourceInventory();
  const [qtyById, setQtyById] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const committed = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of dossier.allocation?.units ?? []) {
      m.set(u.resource_id, u.quantity_available ?? 0);
    }
    return m;
  }, [dossier.allocation?.units]);

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const u of dossier.allocation?.units ?? []) {
      init[u.resource_id] = String(u.quantity_available ?? 0);
    }
    setQtyById(init);
  }, [dossier.crisis_id, dossier.allocation?.units]);

  const poolSorted = useMemo(
    () => [...pool].sort((a, b) => a.name.localeCompare(b.name)),
    [pool],
  );

  const totalCommitted = useMemo(
    () => Object.values(qtyById).reduce((s, v) => s + parseQty(v), 0),
    [qtyById],
  );

  const setQty = (resourceId: string, value: string) => {
    setQtyById((prev) => ({ ...prev, [resourceId]: value.replace(/[^0-9]/g, "") }));
    setOkMsg("");
    setErr("");
  };

  const bump = (resourceId: string, delta: number, max: number) => {
    const cur = parseQty(qtyById[resourceId] ?? "0");
    const next = Math.max(0, Math.min(max, cur + delta));
    setQty(resourceId, String(next));
  };

  const save = async () => {
    setSaving(true);
    setErr("");
    setOkMsg("");
    const assignments: ResourceAssignmentApi[] = Object.entries(qtyById)
      .map(([resource_id, v]) => ({ resource_id, quantity: parseQty(v) }))
      .filter((a) => a.quantity > 0);

    try {
      const updated = await allocateCrisisResources(crisisId, assignments);
      await refreshPool();
      setOkMsg(
        assignments.length > 0
          ? `Committed ${assignments.reduce((s, a) => s + a.quantity, 0)} units`
          : "Cleared crisis allocation",
      );
      onSaved(updated);
    } catch (e) {
      setErr(formatAllocationError((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  const availableFor = (u: ResourceUnitApi) => {
    const inPool = u.quantity_available ?? 0;
    const already = committed.get(u.resource_id) ?? 0;
    const draft = parseQty(qtyById[u.resource_id] ?? "0");
    return inPool + already - draft;
  };

  return (
    <View style={{ marginTop: sectionGap }}>
      <View style={styles.head}>
        <Text style={[styles.sectionTitle, { color: tc.inkMuted }]}>ALLOCATE RESOURCES</Text>
        <Pill tone={totalCommitted > 0 ? "sky" : "mint"}>{totalCommitted} committed</Pill>
      </View>

      <Text style={[styles.hint, { color: tc.inkSoft }]}>
        Units are deducted from the regional pool. Mark crisis{" "}
        <Text style={{ fontWeight: "800" }}>Resolved</Text> to return them.
      </Text>

      {poolLoading && pool.length === 0 ? (
        <ActivityIndicator color={tc.primary} style={{ marginVertical: 16 }} />
      ) : null}

      {poolSorted.slice(0, 12).map((u) => {
        const draft = parseQty(qtyById[u.resource_id] ?? "0");
        const avail = availableFor(u);
        const maxAssignable = avail + draft;

        return (
          <View
            key={u.resource_id}
            style={[styles.row, { backgroundColor: tc.card, borderColor: tc.borderSoft }]}
          >
            <View style={[styles.icon, { backgroundColor: tc.tealSoft }]}>
              <Ionicons name={kindIcon(u.kind)} size={18} color={tc.tealDeep} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[styles.name, { color: tc.ink }]} numberOfLines={1}>
                {u.name}
              </Text>
              <Text style={[styles.sub, { color: tc.inkMuted }]} numberOfLines={1}>
                {kindLabel(u.kind)} · {avail} free in pool
                {u.quantity_total != null ? ` · ${u.quantity_total} total` : ""}
              </Text>
            </View>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => bump(u.resource_id, -1, maxAssignable)}
                disabled={disabled || draft <= 0}
                style={[styles.stepBtn, { borderColor: tc.borderSoft }]}
              >
                <Ionicons name="remove" size={18} color={tc.inkSoft} />
              </Pressable>
              <TextInput
                value={qtyById[u.resource_id] ?? ""}
                onChangeText={(t) => setQty(u.resource_id, t)}
                keyboardType="number-pad"
                editable={!disabled}
                style={[
                  styles.input,
                  { color: tc.ink, borderColor: tc.borderSoft, backgroundColor: tc.muted },
                ]}
              />
              <Pressable
                onPress={() => bump(u.resource_id, 1, maxAssignable)}
                disabled={disabled || draft >= maxAssignable}
                style={[styles.stepBtn, { borderColor: tc.borderSoft }]}
              >
                <Ionicons name="add" size={18} color={tc.tealDeep} />
              </Pressable>
            </View>
          </View>
        );
      })}

      {poolSorted.length > 12 ? (
        <Text style={[styles.more, { color: tc.inkMuted }]}>
          +{poolSorted.length - 12} more in Emergency resources screen
        </Text>
      ) : null}

      {err ? (
        <Text style={[styles.err, { color: tc.alertDeep }]}>{err}</Text>
      ) : null}
      {okMsg ? <Text style={[styles.ok, { color: tc.tealDeep }]}>{okMsg}</Text> : null}

      <Pressable
        onPress={() => void save()}
        disabled={disabled || saving}
        style={[
          styles.saveBtn,
          {
            backgroundColor: tc.primaryDark,
            minHeight: Math.max(minTouch, 48),
            opacity: disabled || saving ? 0.6 : 1,
          },
        ]}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveTxt}>Save allocation</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  hint: { marginTop: 6, marginBottom: 10, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, minWidth: 0 },
  name: { fontSize: 13, fontWeight: "800" },
  sub: { marginTop: 2, fontSize: 11, fontWeight: "600" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    width: 44,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
  },
  more: { fontSize: 11, fontWeight: "600", marginBottom: 8 },
  err: { marginTop: 8, fontSize: 12, fontWeight: "700" },
  ok: { marginTop: 8, fontSize: 12, fontWeight: "700" },
  saveBtn: {
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
  },
  saveTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
