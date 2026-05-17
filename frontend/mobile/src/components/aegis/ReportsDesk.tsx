/**
 * Reports tab — stakeholder drafts: approve / reject.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import {
  audienceLabel,
  rejectStakeholderDraftInFirestore,
  usePendingAlerts,
  writeStakeholderDraftsToFirestore,
  type PendingAlertRow,
} from "../../../lib/firestore/hooks";
import { approveAndDispatchAlert, rejectStakeholderAlert } from "../../../lib/api/gateway";
import { draftStakeholderAlerts } from "../../api/agents";
import {
  fetchLatestDossier,
  getApiBase,
  getDemoModeResolved,
  listSignals,
  probeCloudRunBase,
} from "../../api/client";
import type { CrisisDossierApi } from "../../api/types";
import { useAegisUi } from "../../hooks/useAegisUi";
import { useRootStackNavigation } from "../../navigation/useRootStackNavigation";
import { formatAgentFetchError } from "../../utils/agentErrors";
import {
  buildRuleBasedStakeholderDrafts,
  draftsFromDemoMeta,
  draftsFromDossierNotifications,
  formatReportTime,
  outcomeFromDossier,
} from "../../utils/reportsDesk";
import type { IonName } from "../../utils/alertIcons";
import { Pill } from "./AppShell";

function clip(s: string, max: number): string {
  const t = s.trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function audienceIcon(audience: string): IonName {
  const k = audience.toUpperCase();
  if (k.includes("PUBLIC")) return "people-outline";
  if (k.includes("HOSPITAL") || k.includes("HEALTH")) return "medkit-outline";
  if (k.includes("EMERGENCY") || k.includes("RESCUE")) return "flash-outline";
  if (k.includes("TRANSPORT") || k.includes("TRAFFIC")) return "car-outline";
  if (k.includes("UTILITY") || k.includes("WASA")) return "construct-outline";
  if (k.includes("MEDIA")) return "newspaper-outline";
  return "megaphone-outline";
}

function StatCell({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" | "ok" }) {
  const { tc, r } = useAegisUi();
  const night = useColorScheme() === "dark";
  const bg =
    tone === "warn" ? (night ? "#3b1720" : "#fff1f2") : tone === "ok" ? tc.tealSoft : tc.card;
  const fg = tone === "warn" ? tc.alertDeep : tone === "ok" ? tc.tealDeep : tc.ink;

  return (
    <View style={[st.cell, { backgroundColor: bg, borderColor: tc.borderSoft, minWidth: r.isCompact ? "47%" : "48%" }]}>
      <Text style={[st.val, { color: fg }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[st.lbl, { color: tc.inkMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function Section({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  const { tc } = useAegisUi();
  return (
    <View style={sec.wrap}>
      <View style={sec.head}>
        <Text style={[sec.title, { color: tc.inkMuted }]}>{title}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={10}>
            <Text style={[sec.link, { color: tc.tealDeep }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function DraftCard({
  row,
  busy,
  onApprove,
  onReject,
}: {
  row: PendingAlertRow;
  busy: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const { tc, minTouch } = useAegisUi();
  const [expanded, setExpanded] = useState(false);

  const isPreview = row.status === "preview";
  const canApprove =
    !isPreview && (row.status === "pending_approval" || row.status === "pending");

  return (
    <View style={[card.wrap, { backgroundColor: tc.card, borderColor: tc.borderSoft }]}>
      <View style={card.head}>
        <View style={[card.icon, { backgroundColor: tc.tealSoft }]}>
          <Ionicons name={audienceIcon(row.audienceType)} size={18} color={tc.tealDeep} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[card.aud, { color: tc.tealDeep }]} numberOfLines={1}>
            {audienceLabel(row.audienceType)}
          </Text>
          {row.stagingOrderIndex != null && row.stagingOrderIndex > 0 ? (
            <Text style={[card.stage, { color: tc.inkMuted }]} numberOfLines={1}>
              Order {row.stagingOrderIndex}
              {row.channel ? ` · ${row.channel}` : ""}
            </Text>
          ) : null}
        </View>
        <Pill tone={isPreview ? "amber" : canApprove ? "sky" : "mint"}>
          {isPreview ? "Preview" : canApprove ? "Pending" : "Done"}
        </Pill>
      </View>

      <Text style={[card.title, { color: tc.ink }]} numberOfLines={expanded ? 4 : 2}>
        {row.title}
      </Text>
      <Text style={[card.body, { color: tc.inkSoft }]} numberOfLines={expanded ? 8 : 3}>
        {row.message}
      </Text>
      {row.urduText ? (
        <Text
          style={[card.urdu, { color: tc.ink }]}
          numberOfLines={expanded ? 6 : 2}
        >
          {row.urduText}
        </Text>
      ) : null}

      <View style={card.foot}>
        <Text style={[card.meta, { color: tc.inkMuted }]} numberOfLines={1}>
          {[row.crisisId ? clip(row.crisisId, 24) : null, row.issuedAt ? formatReportTime(row.issuedAt) : null]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={8}>
          <Text style={[card.expand, { color: tc.tealDeep }]}>{expanded ? "Less" : "More"}</Text>
        </Pressable>
      </View>

      {canApprove ? (
        <View style={card.actions}>
          <Pressable
            onPress={() => onReject(row.id)}
            disabled={busy}
            style={[
              card.btn,
              {
                borderColor: tc.borderSoft,
                minHeight: Math.max(minTouch, 44),
                opacity: busy ? 0.5 : 1,
              },
            ]}
          >
            <Text style={[card.rejectLbl, { color: tc.inkMuted }]}>Reject</Text>
          </Pressable>
          <Pressable
            onPress={() => onApprove(row.id)}
            disabled={busy}
            style={[
              card.btn,
              card.approve,
              {
                backgroundColor: tc.primaryDark,
                borderColor: tc.primaryDark,
                minHeight: Math.max(minTouch, 44),
                opacity: busy ? 0.5 : 1,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={card.approveLbl}>Send</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function ReportsDesk() {
  const { tc, r, contentWrap, sectionGap } = useAegisUi();
  const night = useColorScheme() === "dark";
  const rootNav = useRootStackNavigation();
  const { data: firestoreRows, loading, usingFallback } = usePendingAlerts();
  const [dossier, setDossier] = useState<CrisisDossierApi | null>(null);
  const [dossierErr, setDossierErr] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [err, setErr] = useState("");
  const [apiBase, setApiBase] = useState("");
  const [apiReachable, setApiReachable] = useState<boolean | null>(null);

  const loadMeta = useCallback(async () => {
    setDemo(await getDemoModeResolved());
    const base = await getApiBase();
    setApiBase(base);
    const probe = await probeCloudRunBase();
    setApiReachable(probe.reachable);
    try {
      const d = await fetchLatestDossier();
      setDossier(d);
      setDossierErr("");
    } catch (e) {
      setDossier(null);
      setDossierErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMeta();
    }, [loadMeta]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMeta();
    setRefreshing(false);
  }, [loadMeta]);

  const previewRows = useMemo(
    () => (dossier ? draftsFromDossierNotifications(dossier) : []),
    [dossier],
  );

  const demoRows = useMemo(() => draftsFromDemoMeta(), []);

  const rows = useMemo(() => {
    if (firestoreRows.length > 0) return firestoreRows;
    if (previewRows.length > 0) return previewRows;
    if (demo || usingFallback) return demoRows;
    return [];
  }, [firestoreRows, previewRows, demo, usingFallback, demoRows]);

  const pendingCount = firestoreRows.filter(
    (x) => x.status === "pending_approval" || x.status === "pending",
  ).length;
  const outcome = outcomeFromDossier(dossier);
  const liveDrafts = firestoreRows.length > 0;
  const hostShort = apiBase.replace(/^https?:\/\//, "").split("/")[0] ?? "";

  const runDraft = async () => {
    setDrafting(true);
    setErr("");
    setDraftNote("");
    try {
      const signals = await listSignals();
      const top = [...signals].sort(
        (a, b) => (Number(b.severity_hint) || 0) - (Number(a.severity_hint) || 0),
      )[0];
      if (!top) {
        setErr("No alerts — check API in Settings.");
        return;
      }
      try {
        const result = await draftStakeholderAlerts(top, {
          incidentSummary: top.text?.slice(0, 200),
          triagePriority:
            Number(top.severity_hint) >= 8 ? "CRITICAL" : Number(top.severity_hint) >= 6 ? "HIGH" : "MEDIUM",
        });
        setDraftNote(
          `Drafted ${result.drafts.length} for ${top.id}${result.degradedMode ? " (fallback)" : ""}`,
        );
        setApiReachable(true);
      } catch (apiErr) {
        const templates = buildRuleBasedStakeholderDrafts(top);
        const ids = await writeStakeholderDraftsToFirestore(templates);
        setDraftNote(`Saved ${ids.length} templates to Firestore (API offline).`);
        setApiReachable(false);
        setErr(
          apiErr instanceof Error
            ? clip(apiErr.message, 80)
            : "API offline — Firestore templates used.",
        );
      }
    } catch (e) {
      const fe = formatAgentFetchError((e as Error).message, apiBase);
      setErr(fe.message);
    } finally {
      setDrafting(false);
    }
  };

  const handleApprove = async (alertId: string) => {
    setApprovingId(alertId);
    try {
      await approveAndDispatchAlert(alertId);
      Alert.alert("Sent", "Approved and dispatched.");
    } catch (e) {
      Alert.alert("Could not send", e instanceof Error ? e.message : String(e));
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (alertId: string) => {
    setApprovingId(alertId);
    try {
      await rejectStakeholderAlert(alertId);
      Alert.alert("Rejected", "Removed from queue.");
    } catch {
      try {
        await rejectStakeholderDraftInFirestore(alertId);
        Alert.alert("Rejected", "Marked rejected in Firestore.");
      } catch (e2) {
        Alert.alert("Could not reject", e2 instanceof Error ? e2.message : String(e2));
      }
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: tc.canvas }]}
      contentContainerStyle={[
        contentWrap,
        {
          paddingHorizontal: r.horizontalPad,
          paddingTop: r.insets.top + 8,
          paddingBottom: r.tabBarClearance,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={tc.primary} />
      }
    >
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.eyebrow, { color: tc.tealDeep }]}>REPORTS</Text>
          <Text style={[styles.title, { color: tc.ink, fontSize: r.titleSize(22) }]}>Approvals</Text>
        </View>
        <Pill tone={pendingCount > 0 ? "alert" : "mint"}>{pendingCount} pending</Pill>
      </View>

      <View style={[styles.statGrid, { gap: r.gap, marginTop: 12 }]}>
        <StatCell label="Awaiting" value={String(pendingCount)} tone={pendingCount > 0 ? "warn" : "default"} />
        <StatCell label="Showing" value={String(rows.length)} />
        <StatCell
          label="API"
          value={apiReachable ? "Online" : apiReachable === false ? "Offline" : "…"}
          tone={apiReachable ? "ok" : apiReachable === false ? "warn" : "default"}
        />
        <StatCell label="Source" value={liveDrafts ? "Firestore" : previewRows.length ? "Preview" : demo ? "Demo" : "—"} />
      </View>

      <Text style={[styles.meta, { color: tc.inkMuted }]} numberOfLines={2}>
        Stakeholder drafts — approve before dispatch
        {hostShort ? ` · ${clip(hostShort, 28)}` : ""}
      </Text>

      {apiReachable === false ? (
        <Pressable
          onPress={() => rootNav.navigate("Settings")}
          style={[styles.warnBar, { borderColor: tc.amber, backgroundColor: night ? tc.warnSurface : "#fff7ed" }]}
        >
          <Ionicons name="cloud-offline-outline" size={16} color={tc.amberDeep} />
          <Text style={[styles.warnTxt, { color: tc.ink }]} numberOfLines={2}>
            API unreachable — Firestore drafts OK; dispatch needs LAN cloud-run
          </Text>
          <Ionicons name="chevron-forward" size={16} color={tc.inkMuted} />
        </Pressable>
      ) : null}

      {usingFallback && !liveDrafts && !demo ? (
        <Text style={[styles.hint, { color: tc.amberDeep }]}>
          Firestore offline — draft or use demo copy below
        </Text>
      ) : null}

      {!liveDrafts && previewRows.length > 0 ? (
        <Text style={[styles.hint, { color: tc.inkMuted }]}>
          Preview from dossier — approve when Firestore drafts exist
        </Text>
      ) : null}

      <Pressable
        onPress={() => void runDraft()}
        disabled={drafting}
        style={[
          styles.primaryBtn,
          { backgroundColor: tc.primaryDark, marginTop: sectionGap, opacity: drafting ? 0.65 : 1 },
        ]}
      >
        {drafting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="create-outline" size={20} color="#fff" />
            <Text style={styles.primaryBtnTxt}>Draft · top alert</Text>
          </>
        )}
      </Pressable>

      {draftNote ? <Text style={[styles.note, { color: tc.tealDeep }]}>{draftNote}</Text> : null}
      {err ? (
        <View style={[styles.errBar, { borderColor: liveDrafts ? tc.amber : tc.alert, backgroundColor: night ? "#3b1720" : "#fff1f2" }]}>
          <Text style={[styles.errTxt, { color: tc.ink }]} numberOfLines={2}>
            {err}
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: sectionGap }}>
        <Section
          title={`DRAFTS (${rows.length})`}
          actionLabel={rows.length === 0 ? "Pipeline" : undefined}
          onAction={rows.length === 0 ? () => rootNav.navigate("Operations") : undefined}
        >
          {loading && rows.length === 0 ? (
            <View style={styles.centered}>
              <ActivityIndicator color={tc.primary} />
              <Text style={[styles.empty, { color: tc.inkMuted }]}>Loading…</Text>
            </View>
          ) : rows.length === 0 ? (
            <View style={[styles.emptyBox, { borderColor: tc.borderSoft, backgroundColor: tc.card }]}>
              <Ionicons name="megaphone-outline" size={28} color={tc.inkMuted} />
              <Text style={[styles.emptyTitle, { color: tc.ink }]}>No drafts</Text>
              <Text style={[styles.empty, { color: tc.inkMuted }]} numberOfLines={3}>
                Draft messages for the top alert, or run Operations pipeline.
              </Text>
              <Pressable
                onPress={() => rootNav.navigate("Operations")}
                style={[styles.linkBtn, { borderColor: tc.tealDeep }]}
              >
                <Text style={{ color: tc.tealDeep, fontWeight: "800", fontSize: 13 }}>Operations</Text>
              </Pressable>
              {dossierErr ? (
                <Text style={[styles.errSmall, { color: tc.alertDeep }]} numberOfLines={2}>
                  {clip(dossierErr, 100)}
                </Text>
              ) : null}
            </View>
          ) : (
            rows.map((row) => (
              <DraftCard
                key={row.id}
                row={row}
                busy={approvingId === row.id}
                onApprove={(id) => void handleApprove(id)}
                onReject={(id) => void handleReject(id)}
              />
            ))
          )}
        </Section>
      </View>

      {outcome && outcome.actionCount > 0 ? (
        <View style={{ marginTop: sectionGap }}>
          <Section title="SIMULATION">
            <View style={[styles.outCard, { backgroundColor: tc.card, borderColor: tc.borderSoft }]}>
              <Text style={[styles.outTitle, { color: tc.ink }]} numberOfLines={1}>
                {clip(outcome.crisisLabel, 56)}
              </Text>
              <Text style={[styles.outBody, { color: tc.inkSoft }]} numberOfLines={3}>
                {clip(outcome.topInsight, 160)}
              </Text>
            </View>
          </Section>
        </View>
      ) : null}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  cell: {
    flexGrow: 1,
    flexBasis: "48%",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  val: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  lbl: { marginTop: 4, fontSize: 11, fontWeight: "700", lineHeight: 14 },
});

const sec = StyleSheet.create({
  wrap: { marginBottom: 4 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  link: { fontSize: 13, fontWeight: "800" },
});

const card = StyleSheet.create({
  wrap: { padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  aud: { fontSize: 12, fontWeight: "800" },
  stage: { marginTop: 2, fontSize: 10, fontWeight: "600" },
  title: { marginTop: 10, fontSize: 15, fontWeight: "800", lineHeight: 20 },
  body: { marginTop: 6, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  urdu: { marginTop: 8, fontSize: 14, lineHeight: 22, textAlign: "right" },
  foot: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  meta: { flex: 1, fontSize: 10, fontWeight: "600" },
  expand: { fontSize: 12, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 8, marginTop: 10 },
  btn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  approve: {},
  rejectLbl: { fontSize: 13, fontWeight: "800" },
  approveLbl: { color: "#fff", fontSize: 13, fontWeight: "800" },
});

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  title: { marginTop: 2, fontWeight: "800" },
  statGrid: { flexDirection: "row", flexWrap: "wrap" },
  meta: { marginTop: 8, fontSize: 11, fontWeight: "600", lineHeight: 15 },
  warnBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  warnTxt: { flex: 1, fontSize: 12, fontWeight: "600" },
  hint: { marginTop: 8, fontSize: 11, fontWeight: "600" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  primaryBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  note: { marginTop: 8, fontSize: 12, fontWeight: "700" },
  errBar: { marginTop: 8, padding: 10, borderRadius: 12, borderWidth: 1 },
  errTxt: { fontSize: 12, fontWeight: "700", lineHeight: 16 },
  centered: { alignItems: "center", paddingVertical: 20, gap: 8 },
  emptyBox: { alignItems: "center", padding: 20, borderRadius: 14, borderWidth: 1 },
  emptyTitle: { marginTop: 8, fontSize: 15, fontWeight: "800" },
  empty: { marginTop: 4, fontSize: 12, fontWeight: "600", textAlign: "center", lineHeight: 17 },
  linkBtn: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5 },
  errSmall: { marginTop: 8, fontSize: 11, textAlign: "center" },
  outCard: { padding: 12, borderRadius: 14, borderWidth: 1 },
  outTitle: { fontSize: 14, fontWeight: "800" },
  outBody: { marginTop: 6, fontSize: 12, fontWeight: "600", lineHeight: 17 },
});
