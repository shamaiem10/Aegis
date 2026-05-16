import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useResourceInventory } from "../../lib/firestore/hooks";
import { Card, PageHeader, Pill, MiniBar } from "../components/aegis/AppShell";
import { useAegisUi } from "../hooks/useAegisUi";
import { useThemeCiro } from "../theme/useThemeCiro";

export function ResourcesScreen() {
  const { tc, r, contentWrap } = useAegisUi();
  const styles = useMemo(() => createStyles(tc), [tc]);
  const { data: resources, loading } = useResourceInventory();

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
        eyebrow="Operations"
        title="Resource inventory"
        sub="Mirrors web Resources screen — deployable pool with assignment hints."
        right={<Pill tone="mint">{loading ? "Loading..." : `${resources.length} types`}</Pill>}
      />
      {loading && !resources.length ? (
        <View style={{ marginTop: 32 }}>
          <Text style={{ textAlign: "center", color: tc.inkSoft }}>Loading inventory...</Text>
        </View>
      ) : null}
      {resources.map((r) => {
        const pct = Math.round((r.deployed / r.total) * 100);
        return (
          <Card key={r.type} style={styles.card}>
            <View style={styles.iconBox}>
              <Ionicons name={r.icon} size={26} color={tc.primaryDark} />
            </View>
            <View style={styles.cardHead}>
              <Text style={styles.type}>{r.type}</Text>
              <Text style={styles.count}>
                {r.deployed} / {r.total} deployed
              </Text>
            </View>
            <MiniBar value={pct} color={pct > 70 ? tc.amber : tc.primary} />
            {r.healthImpact ? (
              <Text style={styles.healthImpact}>Health impact: {r.healthImpact}</Text>
            ) : null}
            {r.assigned?.length ? (
              <View style={styles.assign}>
                <Text style={styles.assignTitle}>Assignments</Text>
                {r.assigned.map((a, i) => (
                  <Text key={i} style={styles.assignRow}>
                    {a.crisisId} · ETA {a.eta}
                  </Text>
                ))}
              </View>
            ) : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: tc.background },
    inner: { paddingBottom: 48 },
    card: { marginBottom: 14, flexDirection: "column", gap: 0 },
    iconBox: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: tc.sky,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    type: { fontSize: 16, fontWeight: "800", color: tc.ink },
    count: { fontSize: 12, color: tc.inkSoft },
    assign: { marginTop: 12 },
    assignTitle: { fontSize: 10, fontWeight: "800", color: tc.primaryDark, textTransform: "uppercase" },
    assignRow: { marginTop: 6, fontSize: 13, color: tc.ink },
    healthImpact: { marginTop: 10, fontSize: 12, fontWeight: "600", color: tc.sageDeep, lineHeight: 18 },
  });
}
