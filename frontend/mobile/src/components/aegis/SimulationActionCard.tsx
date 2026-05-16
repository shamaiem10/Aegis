import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { SimulatedActionApi } from "../../api/types";
import { useThemeCiro } from "../../theme/useThemeCiro";
import { actionIcon, formatActionTitle } from "../../utils/simulationUi";

type Props = {
  action: SimulatedActionApi;
  selected: boolean;
  expanded: boolean;
  onPress: () => void;
  onToggleExpand?: () => void;
};

export function SimulationActionCard({
  action,
  selected,
  expanded,
  onPress,
  onToggleExpand,
}: Props) {
  const tc = useThemeCiro();
  const icon = actionIcon(action.action_id);
  const title = formatActionTitle(action.action_id);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        {
          borderColor: selected ? tc.tealDeep : tc.border,
          backgroundColor: selected ? tc.tealSoft : tc.card,
        },
      ]}
    >
      <View style={styles.head}>
        <View style={[styles.iconWrap, { backgroundColor: tc.muted }]}>
          <Ionicons name={icon} size={22} color={tc.tealDeep} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.title, { color: tc.ink }]}>{title}</Text>
          <Text style={[styles.oneLine, { color: tc.inkSoft }]} numberOfLines={expanded ? undefined : 2}>
            {action.response_action}
          </Text>
        </View>
        {selected ? (
          <Ionicons name="checkmark-circle" size={22} color={tc.tealDeep} />
        ) : (
          <Ionicons name="ellipse-outline" size={20} color={tc.inkMuted} />
        )}
      </View>

      <View style={styles.metrics}>
        {action.response_time_improvement_min != null ? (
          <View style={[styles.pill, { backgroundColor: tc.muted }]}>
            <Ionicons name="time-outline" size={14} color={tc.tealDeep} />
            <Text style={[styles.pillTxt, { color: tc.ink }]}>
              ~{action.response_time_improvement_min} min faster
            </Text>
          </View>
        ) : null}
        {action.resource_cost_units != null ? (
          <View style={[styles.pill, { backgroundColor: tc.muted }]}>
            <Ionicons name="cube-outline" size={14} color={tc.inkMuted} />
            <Text style={[styles.pillTxt, { color: tc.ink }]}>
              Cost {action.resource_cost_units} units
            </Text>
          </View>
        ) : null}
      </View>

      {expanded && selected ? (
        <View style={[styles.detail, { borderTopColor: tc.border }]}>
          <Text style={[styles.lbl, { color: tc.inkMuted }]}>Before</Text>
          <Text style={[styles.body, { color: tc.ink }]}>{action.before_state}</Text>
          <Text style={[styles.lbl, { color: tc.inkMuted, marginTop: 12 }]}>After we act</Text>
          <Text style={[styles.body, { color: tc.ink }]}>{action.expected_after_state}</Text>
          {action.congestion_impact ? (
            <>
              <Text style={[styles.lbl, { color: tc.inkMuted, marginTop: 12 }]}>Traffic impact</Text>
              <Text style={[styles.body, { color: tc.ink }]}>{action.congestion_impact}</Text>
            </>
          ) : null}
          {action.possible_side_effects?.length ? (
            <>
              <Text style={[styles.lbl, { color: tc.amberDeep, marginTop: 12 }]}>Watch out for</Text>
              {action.possible_side_effects.map((fx, i) => (
                <Text key={i} style={[styles.fx, { color: tc.inkSoft }]}>
                  • {fx}
                </Text>
              ))}
            </>
          ) : null}
          {onToggleExpand ? (
            <Pressable onPress={onToggleExpand} hitSlop={8} style={{ marginTop: 10 }}>
              <Text style={{ fontWeight: "800", color: tc.tealDeep, fontSize: 12 }}>Show less</Text>
            </Pressable>
          ) : null}
        </View>
      ) : selected && onToggleExpand ? (
        <Pressable onPress={onToggleExpand} hitSlop={8}>
          <Text style={{ marginTop: 8, fontWeight: "800", color: tc.tealDeep, fontSize: 12 }}>
            See before / after details
          </Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 10,
  },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "800" },
  oneLine: { marginTop: 4, fontSize: 13, lineHeight: 19, fontWeight: "500" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillTxt: { fontSize: 11, fontWeight: "700" },
  detail: { marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  lbl: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  body: { marginTop: 6, fontSize: 14, lineHeight: 21, fontWeight: "600" },
  fx: { marginTop: 4, fontSize: 13, lineHeight: 19 },
});
