import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { audienceLabel, usePendingAlerts, type PendingAlertRow } from "../../../lib/firestore/hooks";
import { approveAndDispatchAlert } from "../../../lib/api/gateway";
import { fetchLatestDossier, getDemoModeResolved } from "../../api/client";
import type { CrisisDossierApi } from "../../api/types";
import { useAegisUi } from "../../hooks/useAegisUi";
import { useRootStackNavigation } from "../../navigation/useRootStackNavigation";
import { useThemeCiro } from "../../theme/useThemeCiro";
import {
  draftsFromDossierNotifications,
  formatReportTime,
  outcomeFromDossier,
} from "../../utils/reportsDesk";

import { Card, PageHeader } from "./AppShell";

function audienceIcon(audience: string): keyof typeof Ionicons.glyphMap {
  const k = audience.toUpperCase();
  if (k.includes("PUBLIC")) return "people-outline";
  if (k.includes("HOSPITAL") || k.includes("HEALTH")) return "medkit-outline";
  if (k.includes("EMERGENCY") || k.includes("RESCUE")) return "flash-outline";
  if (k.includes("TRANSPORT") || k.includes("TRAFFIC")) return "car-outline";
  if (k.includes("UTILITY") || k.includes("WASA")) return "construct-outline";
  if (k.includes("MEDIA")) return "newspaper-outline";
  return "megaphone-outline";
}

function StakeholderCard({
  row,
  busy,
  onApprove,
  tc,
  styles,
}: {
  row: PendingAlertRow;
  busy: boolean;
  onApprove: (id: string) => void;
  tc: ReturnType<typeof useThemeCiro>;
  styles: ReturnType<typeof createStyles>;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPreview = row.status === "preview";
  const canApprove =
    !isPreview && (row.status === "pending_approval" || row.status === "pending");

  return (
    <View style={[styles.alertCard, { borderColor: tc.border, backgroundColor: tc.card }]}>
      <View style={styles.alertHead}>
        <View style={[styles.audIcon, { backgroundColor: tc.tealSoft }]}>
          <Ionicons name={audienceIcon(row.audienceType)} size={20} color={tc.tealDeep} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.audLabel, { color: tc.tealDeep }]}>
            {audienceLabel(row.audienceType)}
          </Text>
          {row.stagingOrderIndex != null && row.stagingOrderIndex > 0 ? (
            <Text style={[styles.stageHint, { color: tc.inkMuted }]}>
              Staged send · order {row.stagingOrderIndex}
            </Text>
          ) : null}
        </View>
        {canApprove ? (
          <Pressable
            onPress={() => onApprove(row.id)}
            disabled={busy}
            style={[styles.approveBtn, { backgroundColor: tc.primaryDark }, busy && { opacity: 0.5 }]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.approveLbl}>Approve & send</Text>
            )}
          </Pressable>
        ) : isPreview ? (
          <View style={[styles.badge, { backgroundColor: tc.muted }]}>
            <Text style={[styles.badgeTxt, { color: tc.inkMuted }]}>Preview</Text>
          </View>
        ) : (
          <View style={[styles.badge, { backgroundColor: tc.accentGreenSoft }]}>
            <Text style={[styles.badgeTxt, { color: tc.sageDeep }]}>{row.status}</Text>
          </View>
        )}
      </View>

      <Text style={[styles.alertTitle, { color: tc.ink }]} numberOfLines={expanded ? undefined : 2}>
        {row.title}
      </Text>
      <Text style={[styles.alertBody, { color: tc.inkSoft }]} numberOfLines={expanded ? undefined : 4}>
        {row.message}
      </Text>
      {row.urduText ? (
        <Text
          style={[styles.urdu, { color: tc.ink }]}
          numberOfLines={expanded ? undefined : 3}
        >
          {row.urduText}
        </Text>
      ) : null}

      <View style={styles.alertFoot}>
        {row.crisisId ? (
          <Text style={[styles.meta, { color: tc.inkMuted }]} numberOfLines={1}>
            Crisis {row.crisisId}
          </Text>
        ) : null}
        {row.issuedAt ? (
          <Text style={[styles.meta, { color: tc.inkMuted }]}>{formatReportTime(row.issuedAt)}</Text>
        ) : null}
        <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={8}>
          <Text style={[styles.expand, { color: tc.tealDeep }]}>
            {expanded ? "Show less" : "Read full"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ReportsDesk() {
  const { tc, r, contentWrap } = useAegisUi();
  const styles = useMemo(() => createStyles(tc), [tc]);
  const rootNav = useRootStackNavigation();
  const { data: firestoreRows, loading, usingFallback } = usePendingAlerts();
  const [dossier, setDossier] = useState<CrisisDossierApi | null>(null);
  const [dossierErr, setDossierErr] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        setDemo(await getDemoModeResolved());
        try {
          const d = await fetchLatestDossier();
          if (alive) {
            setDossier(d);
            setDossierErr("");
          }
        } catch (e) {
          if (alive) {
            setDossier(null);
            setDossierErr(e instanceof Error ? e.message : String(e));
          }
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const previewRows = useMemo(
    () => (dossier ? draftsFromDossierNotifications(dossier) : []),
    [dossier],
  );

  const rows = firestoreRows.length > 0 ? firestoreRows : previewRows;
  const pendingCount = firestoreRows.filter(
    (x) => x.status === "pending_approval" || x.status === "pending",
  ).length;
  const outcome = outcomeFromDossier(dossier);

  const handleApprove = async (alertId: string) => {
    setApprovingId(alertId);
    try {
      await approveAndDispatchAlert(alertId);
      Alert.alert("Sent", "Alert approved and queued for dispatch channels.");
    } catch (e) {
      Alert.alert("Could not send", e instanceof Error ? e.message : String(e));
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <ScrollView
      style={[styles.wrap, { backgroundColor: tc.canvas }]}
      contentContainerStyle={[
        contentWrap,
        {
          paddingHorizontal: r.horizontalPad,
          paddingTop: r.insets.top + 8,
          paddingBottom: r.tabBarClearance,
        },
      ]}
    >
      <PageHeader
        eyebrow="Operator desk"
        title="Reports & approvals"
        sub="Review AI-drafted stakeholder messages before they go to SMS, EMS, hospitals, and media. Nothing is sent until you approve."
      />

      <View style={[styles.howTo, { backgroundColor: tc.tealSoft, borderColor: tc.border }]}>
        <Text style={[styles.howTitle, { color: tc.tealDeep }]}>How this works</Text>
        <Text style={[styles.howStep, { color: tc.ink }]}>
          1. Run the pipeline on{" "}
          <Text style={{ fontWeight: "800" }}>More → Pipeline</Text> (or Home quick action).
        </Text>
        <Text style={[styles.howStep, { color: tc.ink }]}>
          2. StakeholderAlertAgent writes drafts here as{" "}
          <Text style={{ fontWeight: "800" }}>pending approval</Text>.
        </Text>
        <Text style={[styles.howStep, { color: tc.ink }]}>
          3. Tap <Text style={{ fontWeight: "800" }}>Approve & send</Text> per audience when ready.
        </Text>
      </View>

      <View style={styles.statRow}>
        <View style={[styles.statPill, { backgroundColor: tc.card, borderColor: tc.border }]}>
          <Text style={[styles.statNum, { color: tc.ink }]}>{pendingCount}</Text>
          <Text style={[styles.statLbl, { color: tc.inkMuted }]}>Awaiting you</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: tc.card, borderColor: tc.border }]}>
          <Text style={[styles.statNum, { color: tc.ink }]}>{rows.length}</Text>
          <Text style={[styles.statLbl, { color: tc.inkMuted }]}>
            {firestoreRows.length > 0 ? "Live drafts" : "Dossier preview"}
          </Text>
        </View>
      </View>

      {usingFallback && !demo ? (
        <Card style={[styles.warnCard, { borderColor: tc.amber, backgroundColor: tc.warnSurface }]}>
          <Text style={[styles.warnTitle, { color: tc.amberDeep }]}>Firebase not connected</Text>
          <Text style={[styles.warnBody, { color: tc.ink }]}>
            Approvals need Firestore. Showing notification preview from the latest crisis dossier only.
          </Text>
        </Card>
      ) : null}

      <Text style={[styles.sectionTitle, { color: tc.inkMuted }]}>Pending stakeholder messages</Text>

      {loading && rows.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={tc.primary} />
          <Text style={[styles.empty, { color: tc.inkSoft }]}>Loading drafts…</Text>
        </View>
      ) : rows.length === 0 ? (
        <Card style={{ borderColor: tc.border, backgroundColor: tc.card }}>
          <Ionicons name="document-text-outline" size={36} color={tc.inkMuted} style={{ alignSelf: "center" }} />
          <Text style={[styles.emptyTitle, { color: tc.ink }]}>No drafts yet</Text>
          <Text style={[styles.empty, { color: tc.inkSoft }]}>
            Run the Antigravity pipeline to generate stakeholder alerts. Fast mode on Operations is fine.
          </Text>
          <Pressable
            onPress={() => rootNav.navigate("Operations")}
            style={[styles.cta, { backgroundColor: tc.primaryDark }]}
          >
            <Text style={styles.ctaLbl}>Open Operations pipeline</Text>
          </Pressable>
          {dossierErr ? (
            <Text style={[styles.err, { color: tc.alertDeep }]}>{dossierErr}</Text>
          ) : null}
        </Card>
      ) : (
        <>
          {firestoreRows.length === 0 && previewRows.length > 0 ? (
            <Text style={[styles.previewNote, { color: tc.inkMuted }]}>
              Preview from latest dossier — approve buttons activate once Firestore drafts exist.
            </Text>
          ) : null}
          {rows.map((row) => (
            <StakeholderCard
              key={row.id}
              row={row}
              busy={approvingId === row.id}
              onApprove={(id) => void handleApprove(id)}
              tc={tc}
              styles={styles}
            />
          ))}
        </>
      )}

      {outcome && outcome.actionCount > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: tc.inkMuted, marginTop: 24 }]}>
            Response simulation summary
          </Text>
          <Card style={{ borderColor: tc.border, backgroundColor: tc.card }}>
            <Text style={[styles.outCrisis, { color: tc.ink }]}>{outcome.crisisLabel}</Text>
            <View style={styles.outRow}>
              <View style={styles.outMetric}>
                <Text style={[styles.outVal, { color: tc.tealDeep }]}>{outcome.actionCount}</Text>
                <Text style={[styles.outLbl, { color: tc.inkMuted }]}>Actions modeled</Text>
              </View>
              <View style={styles.outMetric}>
                <Text style={[styles.outVal, { color: tc.tealDeep }]}>{outcome.totalEtaMin}</Text>
                <Text style={[styles.outLbl, { color: tc.inkMuted }]}>Est. minutes saved</Text>
              </View>
            </View>
            <Text style={[styles.outInsight, { color: tc.inkSoft }]}>{outcome.topInsight}</Text>
            <Pressable onPress={() => rootNav.navigate("SimulationLive")} style={{ marginTop: 12 }}>
              <Text style={{ fontWeight: "800", color: tc.tealDeep }}>Open full simulation →</Text>
            </Pressable>
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: { flex: 1 },
    howTo: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      marginBottom: 16,
    },
    howTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
    howStep: { marginTop: 8, fontSize: 13, lineHeight: 20, fontWeight: "600" },
    statRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
    statPill: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: 12,
      paddingHorizontal: 14,
      alignItems: "center",
    },
    statNum: { fontSize: 28, fontWeight: "900" },
    statLbl: { marginTop: 4, fontSize: 11, fontWeight: "700", textAlign: "center" },
    sectionTitle: {
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.5,
      textTransform: "uppercase",
      marginBottom: 10,
    },
    warnCard: { marginBottom: 14, padding: 14, borderWidth: 1 },
    warnTitle: { fontSize: 13, fontWeight: "900" },
    warnBody: { marginTop: 6, fontSize: 13, lineHeight: 19, fontWeight: "600" },
    alertCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
    },
    alertHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    audIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    audLabel: { fontSize: 12, fontWeight: "900" },
    stageHint: { marginTop: 2, fontSize: 10, fontWeight: "600" },
    approveBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      minWidth: 108,
      alignItems: "center",
    },
    approveLbl: { color: "#fff", fontSize: 11, fontWeight: "800" },
    badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    badgeTxt: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
    alertTitle: { marginTop: 12, fontSize: 16, fontWeight: "800", lineHeight: 22 },
    alertBody: { marginTop: 8, fontSize: 14, lineHeight: 21, fontWeight: "500" },
    urdu: { marginTop: 10, fontSize: 15, lineHeight: 24, textAlign: "right" },
    alertFoot: {
      marginTop: 12,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 10,
    },
    meta: { fontSize: 11, fontWeight: "600", flex: 1 },
    expand: { fontSize: 12, fontWeight: "800" },
    centered: { alignItems: "center", paddingVertical: 24, gap: 10 },
    emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: "800", textAlign: "center" },
    empty: { marginTop: 8, fontSize: 14, lineHeight: 21, textAlign: "center", fontWeight: "600" },
    previewNote: { fontSize: 12, fontStyle: "italic", marginBottom: 10 },
    cta: {
      marginTop: 16,
      paddingVertical: 14,
      borderRadius: 999,
      alignItems: "center",
    },
    ctaLbl: { color: "#fff", fontWeight: "800", fontSize: 15 },
    err: { marginTop: 10, fontSize: 12, textAlign: "center" },
    outCrisis: { fontSize: 15, fontWeight: "800" },
    outRow: { flexDirection: "row", gap: 16, marginTop: 14 },
    outMetric: { flex: 1 },
    outVal: { fontSize: 24, fontWeight: "900" },
    outLbl: { marginTop: 4, fontSize: 11, fontWeight: "700" },
    outInsight: { marginTop: 14, fontSize: 13, lineHeight: 20, fontWeight: "600" },
  });
}
