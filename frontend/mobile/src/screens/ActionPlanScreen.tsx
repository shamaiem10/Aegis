import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Card, GradientHeroCard, MiniBar } from "../components/aegis/AppShell";
import { useAegisUi } from "../hooks/useAegisUi";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import type { IonName } from "../utils/alertIcons";
import { useThemeCiro } from "../theme/useThemeCiro";

type Props = NativeStackScreenProps<RootStackParamList, "ActionPlan">;

const BAR_BLUE = "#0ea5e9";
const BAR_TEAL = "#14b8a6";

const ACTIONS: {
  title: string;
  pri: "CRITICAL" | "HIGH" | "MEDIUM";
  eta: string;
  impact: number;
  iconTint: string;
  barColor: string;
  iconName: IonName;
}[] = [
  {
    title: "Redirect traffic to alternate routes",
    pri: "CRITICAL",
    eta: "2 min",
    impact: 78,
    iconTint: "#dc2626",
    barColor: BAR_BLUE,
    iconName: "swap-horizontal-outline",
  },
  {
    title: "Dispatch emergency unit",
    pri: "HIGH",
    eta: "5 min",
    impact: 65,
    iconTint: "#ea580c",
    barColor: BAR_TEAL,
    iconName: "medkit-outline",
  },
  {
    title: "Notify nearby users",
    pri: "HIGH",
    eta: "Instant",
    impact: 54,
    iconTint: "#2563eb",
    barColor: BAR_TEAL,
    iconName: "megaphone-outline",
  },
  {
    title: "Generate authority ticket",
    pri: "MEDIUM",
    eta: "1 min",
    impact: 32,
    iconTint: "#16a34a",
    barColor: "#22c55e",
    iconName: "document-text-outline",
  },
];

export function ActionPlanScreen({}: Props) {
  const { tc, r, contentWrap } = useAegisUi();
  const styles = useMemo(() => createStyles(tc), [tc]);
  const stackCards = r.isCompact || r.width < 400;
  const iconSz = r.isCompact ? 44 : 48;
  const glyph = r.isCompact ? 22 : 24;
  const metaIcon = r.isCompact ? 13 : 14;

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={[
        styles.inner,
        contentWrap,
        {
          paddingHorizontal: r.horizontalPad,
          paddingTop: 8,
          paddingBottom: r.tabBarClearance,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <GradientHeroCard style={r.isCompact ? styles.heroTight : undefined}>
        <Text style={[styles.eyebrow, { fontSize: r.bodySize(10) }]} maxFontSizeMultiplier={1.35}>
          Recommended
        </Text>
        <Text style={[styles.title, { fontSize: r.titleSize(22) }]} maxFontSizeMultiplier={1.3}>
          Coordinated Actions
        </Text>
        <Text
          style={[styles.sub, { fontSize: r.bodySize(14) }]}
          maxFontSizeMultiplier={1.35}
        >
          4 interventions ranked by AI impact model
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="analytics-outline" size={metaIcon} color={tc.sageDeep} />
            <Text style={[styles.meta, { fontSize: r.bodySize(12) }]} maxFontSizeMultiplier={1.35}>
              AI scored
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={metaIcon} color={tc.inkMuted} />
            <Text style={[styles.meta, { fontSize: r.bodySize(12) }]} maxFontSizeMultiplier={1.35}>
              8 min total
            </Text>
          </View>
        </View>
      </GradientHeroCard>

      {ACTIONS.map((a, i) => (
        <Card key={i} style={styles.item}>
          {stackCards ? (
            <View style={styles.itemStack}>
              <View style={styles.itemHeadRow}>
                <View style={[styles.iconBlob, { backgroundColor: `${a.iconTint}22`, width: iconSz, height: iconSz }]}>
                  <Ionicons name={a.iconName} size={glyph} color={a.iconTint} />
                </View>
                <Text
                  style={[styles.itemTitle, styles.itemTitleFlex, { fontSize: r.bodySize(15) }]}
                  maxFontSizeMultiplier={1.35}
                >
                  {a.title}
                </Text>
              </View>
              <View style={[styles.tagImpactRowFull, { paddingLeft: iconSz + 12 }]}>
                <View style={[styles.tagRow, styles.tagRowInBar]}>
                  <Text style={[styles.pri, { color: a.iconTint, fontSize: r.bodySize(11) }]} maxFontSizeMultiplier={1.25}>
                    {a.pri}
                  </Text>
                  <Text style={[styles.eta, { fontSize: r.bodySize(12) }]} maxFontSizeMultiplier={1.35}>
                    {a.eta}
                  </Text>
                </View>
                <View style={styles.impactCol}>
                  <Text style={[styles.impactLblSmall, { fontSize: r.bodySize(9) }]} maxFontSizeMultiplier={1.2}>
                    Impact
                  </Text>
                  <Text style={[styles.impact, { color: a.iconTint, fontSize: r.titleSize(18) }]} maxFontSizeMultiplier={1.25}>
                    {a.impact}%
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.itemTop}>
              <View style={[styles.iconBlob, { backgroundColor: `${a.iconTint}22`, width: iconSz, height: iconSz }]}>
                <Ionicons name={a.iconName} size={glyph} color={a.iconTint} />
              </View>
              <View style={styles.itemMain}>
                <Text style={[styles.itemTitle, { fontSize: r.bodySize(15) }]} maxFontSizeMultiplier={1.35}>
                  {a.title}
                </Text>
                <View style={styles.tagRow}>
                  <Text style={[styles.pri, { color: a.iconTint, fontSize: r.bodySize(11) }]} maxFontSizeMultiplier={1.25}>
                    {a.pri}
                  </Text>
                  <Text style={[styles.eta, { fontSize: r.bodySize(12) }]} maxFontSizeMultiplier={1.35}>
                    {a.eta}
                  </Text>
                </View>
              </View>
              <View style={styles.impactColSide}>
                <Text style={[styles.impactLblSmall, { fontSize: r.bodySize(9) }]} maxFontSizeMultiplier={1.2}>
                  Impact
                </Text>
                <Text style={[styles.impact, { color: a.iconTint, fontSize: r.titleSize(18) }]} maxFontSizeMultiplier={1.25}>
                  {a.impact}%
                </Text>
              </View>
            </View>
          )}
          <MiniBar value={a.impact} color={a.barColor} />
        </Card>
      ))}
    </ScrollView>
  );
}

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: tc.canvas },
    inner: { paddingTop: 12 },
    eyebrow: {
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 2,
      color: tc.sageDeep,
      textTransform: "uppercase",
    },
    title: { marginTop: 8, fontWeight: "900", color: tc.ink },
    sub: { marginTop: 8, color: tc.inkSoft, fontWeight: "600", lineHeight: 20 },
    metaRow: { flexDirection: "row", marginTop: 12, flexWrap: "wrap", gap: 12, rowGap: 8 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
    meta: { fontWeight: "700", color: tc.inkMuted },
    heroTight: { paddingVertical: 16, paddingHorizontal: 16 },
    item: { marginBottom: 12 },
    itemStack: { gap: 10 },
    itemHeadRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    itemTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    itemMain: { flex: 1, minWidth: 0 },
    tagImpactRowFull: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      flexWrap: "wrap",
    },
    iconBlob: {
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    itemTitle: { fontWeight: "800", color: tc.ink, letterSpacing: -0.2 },
    itemTitleFlex: { flex: 1, minWidth: 0 },
    tagRow: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 8, flexWrap: "wrap", minWidth: 0 },
    tagRowInBar: { marginTop: 0 },
    pri: { fontWeight: "900", letterSpacing: 0.8 },
    eta: { fontWeight: "700", color: tc.inkMuted },
    impactCol: { alignItems: "flex-end", flexShrink: 0 },
    impactColSide: { alignItems: "flex-end", flexShrink: 0, marginLeft: 4 },
    impactLblSmall: { fontWeight: "800", color: tc.inkMuted, letterSpacing: 0.6 },
    impact: { fontWeight: "900", marginTop: 2 },
  });
}
