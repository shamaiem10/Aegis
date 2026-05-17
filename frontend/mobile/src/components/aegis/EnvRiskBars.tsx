import { StyleSheet, Text, View } from "react-native";

import { useThemeCiro } from "../../theme/useThemeCiro";

export function EnvRiskBar({
  label,
  value,
  color,
  sub,
  recommendation,
}: {
  label: string;
  value: number;
  color: string;
  sub: string;
  recommendation?: string;
}) {
  const tc = useThemeCiro();
  const pct = Math.min(100, Math.max(0, value));

  return (
    <View style={bar.wrap}>
      <View style={bar.top}>
        <Text style={[bar.label, { color: tc.ink }]}>{label}</Text>
        <Text style={[bar.pct, { color }]}>{pct}%</Text>
      </View>
      <View style={[bar.track, { backgroundColor: tc.muted }]}>
        <View style={[bar.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[bar.sub, { color: tc.inkSoft }]} numberOfLines={3}>
        {sub}
      </Text>
    </View>
  );
}

const bar = StyleSheet.create({
  wrap: { marginTop: 14 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  label: { fontSize: 14, fontWeight: "800", flex: 1, marginRight: 8 },
  pct: { fontSize: 15, fontWeight: "900" },
  track: { height: 10, borderRadius: 999, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999 },
  sub: { marginTop: 8, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  rec: { marginTop: 6, fontSize: 12, fontWeight: "700", lineHeight: 17 },
});
