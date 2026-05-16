import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { AlertPriority } from "./AppShell";
import type { IonName } from "../../utils/alertIcons";
import { useThemeCiro } from "../../theme/useThemeCiro";

export function HomeAlertRow({
  iconName,
  title,
  timeLabel,
  priority,
  onPress,
}: {
  iconName: IonName;
  title: string;
  timeLabel: string;
  priority: AlertPriority;
  onPress?: () => void;
}) {
  const tc = useThemeCiro();
  const night = useColorScheme() === "dark";
  const pri =
    priority === "HIGH" ?
      { bg: night ? "#3b1720" : "#ffe4e6", fg: tc.alertDeep, t: "HIGH" as const }
    : priority === "MED" ?
      { bg: tc.warnSurface, fg: tc.amberDeep, t: "MED" as const }
    : { bg: tc.muted, fg: tc.inkSoft, t: "LOW" as const };

  const Inner = (
    <View style={[styles.row, { backgroundColor: tc.card, borderColor: tc.border }]}>
      <View style={[styles.icon, { backgroundColor: tc.tealSoft }]}>
        <Ionicons name={iconName} size={20} color={tc.tealDeep} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: tc.ink }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.time, { color: tc.inkMuted }]} numberOfLines={1}>
          {timeLabel}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: pri.bg }]}>
        <Text style={[styles.badgeTxt, { color: pri.fg }]}>{pri.t}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={tc.inkMuted} /> : null}
    </View>
  );

  if (!onPress) return Inner;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      {Inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "800", lineHeight: 21 },
  time: { marginTop: 4, fontSize: 12, fontWeight: "600" },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    minWidth: 40,
    alignItems: "center",
  },
  badgeTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
});
