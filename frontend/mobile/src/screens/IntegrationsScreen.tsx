import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, Switch, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { useAPIHealth } from "../../lib/firestore/hooks";
import { Card, PageHeader, Pill, MiniBar } from "../components/aegis/AppShell";
import type { PillTone } from "../components/aegis/AppShell";
import { fetchLatestDossier, summarizeBackendError } from "../api/client";
import { useAegisUi } from "../hooks/useAegisUi";
import { useThemeCiro } from "../theme/useThemeCiro";

function statusTone(s: string): PillTone {
  if (s === "Online") return "mint";
  if (s === "Slow" || s === "Degraded") return "amber";
  return "alert";
}

export function IntegrationsScreen() {
  const { tc, r, contentWrap } = useAegisUi();
  const styles = useMemo(() => createStyles(tc), [tc]);
  const [baselinePct, setBaselinePct] = useState(91);
  const [degradedSim, setDegradedSim] = useState(false);
  const [err, setErr] = useState("");

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          setErr("");
          const d = await fetchLatestDossier();
          if (!alive) return;
          const m = d.meta ?? {};
          const im = m.ingest_meta as { environmental_signal_quality_pct?: number } | undefined;
          const top = typeof m.environmental_signal_quality_pct === "number" ? m.environmental_signal_quality_pct : im?.environmental_signal_quality_pct;
          if (typeof top === "number") setBaselinePct(Math.max(0, Math.min(100, top)));
        } catch (e) {
          if (alive) setErr(summarizeBackendError(e instanceof Error ? e.message : String(e)));
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const { data: apiHealth, loading } = useAPIHealth();
  const displayPct = degradedSim ? 73 : baselinePct;

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={[
        contentWrap,
        styles.inner,
        { paddingHorizontal: r.horizontalPad, paddingTop: r.insets.top + 8 },
      ]}
    >
      <PageHeader
        eyebrow="Connectivity"
        title="Integration health"
        sub="Live dossier can drive environmental quality; toggle degraded mode to preview sensor-mesh fallback copy (demo: 73%)."
      />
      {err ? (
        <Card style={styles.errBox}>
          <Text style={styles.errTxt}>{err}</Text>
        </Card>
      ) : null}

      <Card style={styles.meterCard}>
        <Text style={styles.meterLbl}>Environmental signal quality</Text>
        <Text style={styles.meterPct}>{displayPct}%</Text>
        <MiniBar value={displayPct} color={displayPct < 80 ? tc.amber : tc.accentGreen} />
        <Text style={styles.meterCopy}>
          {degradedSim
            ? "Sensor mesh degrading — backup interpolation active; treat PM2.5 / plume edges as lower confidence until PEPA secondary validation completes."
            : "Multi-source ingest healthy: PEPA, PMD, satellite queue, and hospital feeds within expected latency (bundled demo baseline)."}
        </Text>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.toggleTitle}>Simulate degraded sensors</Text>
            <Text style={styles.toggleSub}>Matches v2 spec: quality drops to ~73% when nodes foul or drop.</Text>
          </View>
          <Switch value={degradedSim} onValueChange={setDegradedSim} />
        </View>
      </Card>

      {loading && !apiHealth.length ? (
        <View style={{ marginTop: 16 }}>
          <Text style={{ textAlign: "center", color: tc.inkSoft }}>Loading API health...</Text>
        </View>
      ) : null}

      {apiHealth.map((row) => (
        <Card key={row.name} style={styles.card}>
          <Text style={styles.name}>{row.name}</Text>
          <Pill tone={statusTone(row.status)}>
            {row.status} {row.latency ? `· ${row.latency}` : ""}
          </Pill>
        </Card>
      ))}
    </ScrollView>
  );
}

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: tc.background },
    inner: { paddingBottom: 40 },
    card: {
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    },
    name: { fontSize: 15, fontWeight: "700", color: tc.ink, flex: 1 },
    meterCard: { marginBottom: 14 },
    meterLbl: {
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 2,
      color: tc.inkMuted,
      textTransform: "uppercase",
    },
    meterPct: { marginTop: 8, fontSize: 28, fontWeight: "900", color: tc.ink },
    meterCopy: { marginTop: 10, fontSize: 13, color: tc.inkSoft, lineHeight: 20, fontWeight: "600" },
    toggleRow: {
      marginTop: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tc.border,
    },
    toggleTitle: { fontSize: 14, fontWeight: "800", color: tc.ink },
    toggleSub: { marginTop: 4, fontSize: 11, color: tc.inkMuted, lineHeight: 16 },
    errBox: { marginBottom: 12, padding: 12, backgroundColor: "rgba(239,68,68,0.08)" },
    errTxt: { color: "#b91c1c", fontWeight: "700", fontSize: 12 },
  });
}
