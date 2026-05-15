import { useCallback, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { Card, PageHeader } from "../components/aegis/AppShell";
import { getDemoModeResolved, runPipeline, fetchLatestDossier } from "../api/client";
import type { AuditLogEntryApi, CrisisDossierApi } from "../api/types";
import { useAegisUi } from "../hooks/useAegisUi";
import { useThemeCiro } from "../theme/useThemeCiro";

type LogFilter = "all" | "environmental";

function isEnvironmentalAudit(a: AuditLogEntryApi): boolean {
  const note = typeof a.note === "string" ? a.note : "";
  const blob = `${a.event} ${note}`.toLowerCase();
  return (
    /aqi|pm2|pm10|dust|pepa|pmd|satellite|plume|wind|air quality|storm|mask|advisory|f-7|g-7|humid|heat|compound|environmental/.test(
      blob,
    )
  );
}

export function OperationsScreen() {
  const { tc, r, contentWrap } = useAegisUi();
  const styles = useMemo(() => createStyles(tc), [tc]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CrisisDossierApi | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [useGemini, setUseGemini] = useState(false);
  const [audit, setAudit] = useState<AuditLogEntryApi[]>([]);
  const [logFilter, setLogFilter] = useState<LogFilter>("all");

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        setDemo(await getDemoModeResolved());
        try {
          const d = await fetchLatestDossier();
          if (!alive) return;
          const m = d.meta ?? {};
          setAudit(Array.isArray(m.audit_log) ? (m.audit_log as AuditLogEntryApi[]) : []);
        } catch {
          if (alive) setAudit([]);
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const filteredAudit = useMemo(
    () => (logFilter === "environmental" ? audit.filter(isEnvironmentalAudit) : audit),
    [audit, logFilter],
  );

  const fire = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await runPipeline({
        include_weather: true,
        use_llm_classifier: useGemini,
      });
      setResult(r);
      const m = r.meta ?? {};
      if (Array.isArray(m.audit_log)) setAudit(m.audit_log as AuditLogEntryApi[]);
    } catch (e) {
      setErr(String((e as Error).message));
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={[
        contentWrap,
        {
          paddingHorizontal: r.horizontalPad,
          paddingTop: r.insets.top + 12,
          paddingBottom: 40,
        },
      ]}
    >
      <PageHeader
        eyebrow="Fusion"
        title="Operations pipeline"
        sub={demo ? "Demo simulates a new dossier locally. Incident log below is from the latest bundled meta." : "POST /api/v1/pipeline/run plus live audit tail."}
      />
      {!demo ? (
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Gemini classifier</Text>
            <Text style={styles.rowSub}>
              Sends use_llm_classifier to your FastAPI backend (needs GEMINI_API_KEY or Vertex there).
            </Text>
          </View>
          <Switch value={useGemini} onValueChange={setUseGemini} />
        </View>
      ) : null}
      <Pressable
        onPress={() => void fire()}
        disabled={busy}
        style={[styles.btn, busy && { opacity: 0.6 }]}
      >
        <Text style={styles.btnLbl}>{busy ? "Running…" : demo ? "Simulate pipeline" : "Execute pipeline"}</Text>
      </Pressable>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {result ? (
        <View style={styles.out}>
          <Text style={styles.outTitle}>Latest crisis</Text>
          <Text style={styles.mono}>{result.crisis_id}</Text>
          <Text style={styles.body}>
            {result.classification.category} · severity {result.severity.score}
          </Text>
          <Text style={styles.metaJson} numberOfLines={8}>
            {JSON.stringify(result.meta ?? {}, null, 2)}
          </Text>
        </View>
      ) : null}

      <Text style={styles.logSection}>Incident log</Text>
      <Text style={styles.logHint}>Pulled from latest dossier <Text style={styles.bold}>meta.audit_log</Text> (Islamabad v2 demo).</Text>
      <View style={styles.filterRow}>
        {(
          [
            { id: "all" as const, label: "All" },
            { id: "environmental" as const, label: "Environmental" },
          ] as const
        ).map((f) => {
          const on = logFilter === f.id;
          return (
            <Pressable key={f.id} onPress={() => setLogFilter(f.id)} style={[styles.filterChip, on && styles.filterChipOn]}>
              <Text style={[styles.filterChipTxt, on && styles.filterChipTxtOn]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {filteredAudit.length === 0 ? (
        <Text style={styles.emptyLog}>No log rows for this filter. Run pipeline or enable demo data.</Text>
      ) : (
        filteredAudit.map((a, i) => (
          <Card key={`${a.ts}-${a.event}-${i}`} style={styles.logCard}>
            <Text style={styles.logTime}>{a.ts?.replace("T", " ").slice(0, 19) ?? "—"}</Text>
            <Text style={styles.logEvent}>{a.event}</Text>
            {typeof a.note === "string" ? <Text style={styles.logNote}>{a.note}</Text> : null}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: tc.background },
    h1: { fontSize: 22, fontWeight: "800", color: tc.ink },
    intro: { fontSize: 13, color: tc.inkSoft, marginTop: 6, marginBottom: 12, lineHeight: 18 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 16,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: tc.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: tc.border,
    },
    rowText: { flex: 1, paddingRight: 8 },
    rowTitle: { fontSize: 15, fontWeight: "700", color: tc.ink },
    rowSub: { fontSize: 11, color: tc.inkSoft, marginTop: 4, lineHeight: 15 },
    btn: {
      backgroundColor: tc.primaryDark,
      paddingVertical: 14,
      borderRadius: 999,
      alignItems: "center",
    },
    btnLbl: { color: "#fff", fontWeight: "800", fontSize: 15 },
    err: { color: tc.alertDeep, marginTop: 12, fontWeight: "600" },
    out: {
      marginTop: 20,
      backgroundColor: tc.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: tc.border,
    },
    outTitle: { fontSize: 12, fontWeight: "800", color: tc.inkMuted, marginBottom: 6 },
    mono: { fontSize: 13, color: tc.ink, fontWeight: "700" },
    body: { fontSize: 15, fontWeight: "600", marginTop: 6, textTransform: "capitalize" },
    metaJson: {
      fontSize: 11,
      color: tc.inkSoft,
      marginTop: 8,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    logSection: {
      marginTop: 28,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 2,
      color: tc.inkMuted,
      textTransform: "uppercase",
    },
    logHint: { marginTop: 8, fontSize: 12, color: tc.inkSoft, lineHeight: 17 },
    bold: { fontWeight: "800", color: tc.ink },
    filterRow: { flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 10 },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: tc.border,
      backgroundColor: tc.card,
    },
    filterChipOn: { borderColor: tc.tealDeep, backgroundColor: tc.tealSoft },
    filterChipTxt: { fontSize: 12, fontWeight: "800", color: tc.ink },
    filterChipTxtOn: { color: tc.tealDeep },
    logCard: { marginBottom: 10, padding: 12 },
    logTime: { fontSize: 10, fontWeight: "800", color: tc.inkMuted, letterSpacing: 0.5 },
    logEvent: { marginTop: 4, fontSize: 14, fontWeight: "900", color: tc.ink },
    logNote: { marginTop: 6, fontSize: 12, color: tc.inkSoft, lineHeight: 17 },
    emptyLog: { marginTop: 8, fontSize: 13, color: tc.inkMuted, fontStyle: "italic" },
  });
}
