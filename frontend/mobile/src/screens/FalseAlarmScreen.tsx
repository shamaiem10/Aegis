import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Card, PageHeader } from "../components/aegis/AppShell";
import { DEMO_ORCHESTRATION_META } from "../data/demoOrchestrationMeta";
import { useAegisUi } from "../hooks/useAegisUi";
import { useThemeCiro } from "../theme/useThemeCiro";

export function FalseAlarmScreen() {
  const { tc, r, contentWrap } = useAegisUi();
  const queue = (DEMO_ORCHESTRATION_META.false_alarm_queue ?? []) as {
    id: string;
    title: string;
    reason: string;
    impact: string;
    status: string;
  }[];

  return (
    <ScrollView
      style={[styles.wrap, { backgroundColor: tc.background }]}
      contentContainerStyle={[
        contentWrap,
        styles.inner,
        { paddingHorizontal: r.horizontalPad, paddingTop: r.insets.top + 8 },
      ]}
    >
      <PageHeader
        eyebrow="Intelligence"
        title="False alarm handler"
        sub="Pre-alert catches (v2 — air quality barbecue vs industrial smoke)."
      />
      {queue.map((q) => (
        <Card key={q.id} style={[styles.card, { borderColor: tc.border, backgroundColor: tc.card }]}>
          <Text style={[styles.status, { color: tc.sageDeep }]}>{q.status}</Text>
          <Text style={[styles.title, { color: tc.ink }]}>{q.title}</Text>
          <Text style={[styles.body, { color: tc.inkSoft }]}>{q.reason}</Text>
          <Text style={[styles.impact, { color: tc.ink, borderTopColor: tc.border }]}>
            Impact score: {q.impact}
          </Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  inner: { paddingBottom: 48 },
  card: { marginBottom: 14, borderWidth: 1, padding: 14 },
  status: { fontSize: 10, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  title: { fontSize: 17, fontWeight: "900", marginTop: 8 },
  body: { marginTop: 8, lineHeight: 20, fontWeight: "600", fontSize: 14 },
  impact: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, fontWeight: "700", lineHeight: 20 },
});
