/**
 * Agent traces — timeline of real Groq/agent runs with parsed outcomes.
 */

import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAntigravityTraces } from "../../../lib/firestore/hooks";
import { useAegisUi } from "../../hooks/useAegisUi";
import { useRootStackNavigation } from "../../navigation/useRootStackNavigation";
import { Pill } from "./AppShell";
import {
  agentMeta,
  normalizeTraceDisplay,
  type TraceDisplay,
} from "../../utils/tracePresentation";

function TraceTimelineItem({
  item,
  isFirst,
  isLast,
  onPress,
}: {
  item: TraceDisplay;
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  const { tc } = useAegisUi();

  return (
    <Pressable onPress={onPress} style={tl.row}>
      <View style={tl.rail}>
        {!isFirst ? <View style={[tl.line, { backgroundColor: tc.borderSoft }]} /> : <View style={tl.lineGap} />}
        <View style={[tl.node, { backgroundColor: tc.tealDeep, borderColor: tc.canvas }]}>
          <Ionicons name={item.icon} size={14} color="#fff" />
        </View>
        {!isLast ? <View style={[tl.line, { backgroundColor: tc.borderSoft, flex: 1 }]} /> : null}
      </View>

      <View
        style={[
          tl.card,
          {
            backgroundColor: tc.card,
            borderColor: tc.borderSoft,
            marginBottom: isLast ? 0 : 12,
          },
        ]}
      >
        <View style={tl.cardHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[tl.agent, { color: tc.tealDeep }]}>{item.agentLabel}</Text>
            <Text style={[tl.time, { color: tc.inkMuted }]}>{item.timeAgo}</Text>
          </View>
          {item.confidencePct != null ? (
            <Text style={[tl.conf, { color: tc.inkMuted }]}>{item.confidencePct}%</Text>
          ) : null}
        </View>

        <Text style={[tl.title, { color: tc.ink }]}>{item.title}</Text>
        {item.subtitle ? (
          <Text style={[tl.sub, { color: tc.inkSoft }]} numberOfLines={3}>
            {item.subtitle}
          </Text>
        ) : null}

        {item.badges.length > 0 ? (
          <View style={tl.badges}>
            {item.badges.map((b) => (
              <Pill key={b.label} tone={b.tone}>
                {b.label}
              </Pill>
            ))}
          </View>
        ) : null}

        <View style={tl.footer}>
          <Text style={[tl.hint, { color: tc.tealDeep }]}>
            {item.signalId ? "Open alert" : item.crisisId ? "Open crisis" : "View details"}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={tc.inkMuted} />
        </View>
      </View>
    </Pressable>
  );
}

export function AgentTracesLayout() {
  const { tc, r, contentWrap, sectionGap } = useAegisUi();
  const rootNav = useRootStackNavigation();
  const { data: traces, loading, usingFallback } = useAntigravityTraces();
  const [query, setQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState<string | "all">("all");
  const [refreshing, setRefreshing] = useState(false);

  const displays = useMemo(() => traces.map(normalizeTraceDisplay), [traces]);

  const agentOptions = useMemo(() => {
    const ids = [...new Set(displays.map((d) => d.agentId))];
    return ids.map((id) => ({ id, ...agentMeta(id) }));
  }, [displays]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return displays.filter((d) => {
      if (agentFilter !== "all" && d.agentId !== agentFilter) return false;
      if (!q) return true;
      const hay = `${d.agentLabel} ${d.title} ${d.subtitle} ${d.agentId}`.toLowerCase();
      return hay.includes(q);
    });
  }, [displays, agentFilter, query]);

  const lastRun = displays[0]?.timeAgo ?? "—";
  const escalateCount = displays.filter((d) =>
    d.badges.some((b) => b.label === "CRITICAL" || b.label === "HIGH" || b.label === "Escalate"),
  ).length;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((res) => setTimeout(res, 400));
    setRefreshing(false);
  }, []);

  const openTrace = (item: TraceDisplay) => {
    if (item.signalId) {
      rootNav.navigate("AlertAnalysis", { signalId: item.signalId });
      return;
    }
    if (item.crisisId) {
      rootNav.navigate("CrisisDetail", { id: item.crisisId });
    }
  };

  const header = (
    <View>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.eyebrow, { color: tc.tealDeep }]}>AGENT LOG</Text>
          <Text style={[styles.title, { color: tc.ink, fontSize: r.titleSize(22) }]}>
            What agents did
          </Text>
        </View>
        <Pill tone={usingFallback ? "amber" : "mint"}>{usingFallback ? "Offline" : "Live"}</Pill>
      </View>

      <Text style={[styles.lead, { color: tc.inkSoft }]}>
        Each step is a real Groq run — triage headlines, analysis, and plans. Tap a row to open the
        alert or crisis.
      </Text>

      <View style={[styles.summaryBar, { backgroundColor: tc.card, borderColor: tc.borderSoft }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryVal, { color: tc.ink }]}>{loading ? "…" : displays.length}</Text>
          <Text style={[styles.summaryLbl, { color: tc.inkMuted }]}>Runs</Text>
        </View>
        <View style={[styles.summaryDiv, { backgroundColor: tc.borderSoft }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryVal, { color: tc.ink }]}>{agentOptions.length}</Text>
          <Text style={[styles.summaryLbl, { color: tc.inkMuted }]}>Agents</Text>
        </View>
        <View style={[styles.summaryDiv, { backgroundColor: tc.borderSoft }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryVal, { color: escalateCount > 0 ? tc.alertDeep : tc.ink }]}>
            {escalateCount}
          </Text>
          <Text style={[styles.summaryLbl, { color: tc.inkMuted }]}>Escalations</Text>
        </View>
        <View style={[styles.summaryDiv, { backgroundColor: tc.borderSoft }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryVal, { color: tc.ink }]} numberOfLines={1}>
            {lastRun}
          </Text>
          <Text style={[styles.summaryLbl, { color: tc.inkMuted }]}>Latest</Text>
        </View>
      </View>

      <View style={[styles.search, { backgroundColor: tc.card, borderColor: tc.borderSoft, marginTop: sectionGap }]}>
        <Ionicons name="search-outline" size={18} color={tc.inkMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search headline or agent…"
          placeholderTextColor={tc.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.searchInput, { color: tc.ink }]}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery("")} hitSlop={10}>
            <Ionicons name="close-circle" size={20} color={tc.inkMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.agentChips, { marginTop: 10 }]}>
        <Pressable
          onPress={() => setAgentFilter("all")}
          style={[
            styles.agentChip,
            {
              backgroundColor: agentFilter === "all" ? tc.tealSoft : tc.card,
              borderColor: agentFilter === "all" ? tc.tealDeep : tc.borderSoft,
            },
          ]}
        >
          <Text
            style={[
              styles.agentChipTxt,
              { color: agentFilter === "all" ? tc.tealDeep : tc.ink },
            ]}
          >
            All
          </Text>
        </Pressable>
        {agentOptions.slice(0, 6).map((a) => {
          const on = agentFilter === a.id;
          return (
            <Pressable
              key={a.id}
              onPress={() => setAgentFilter(a.id)}
              style={[
                styles.agentChip,
                {
                  backgroundColor: on ? tc.tealSoft : tc.card,
                  borderColor: on ? tc.tealDeep : tc.borderSoft,
                },
              ]}
            >
              <Ionicons name={a.icon} size={12} color={on ? tc.tealDeep : tc.inkMuted} />
              <Text
                style={[styles.agentChipTxt, { color: on ? tc.tealDeep : tc.ink }]}
                numberOfLines={1}
              >
                {a.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.countLbl, { color: tc.inkMuted, marginTop: 12, marginBottom: 8 }]}>
        {filtered.length} of {displays.length} runs
      </Text>
    </View>
  );

  return (
    <View style={[styles.outer, { backgroundColor: tc.canvas }]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          contentWrap,
          {
            paddingHorizontal: r.horizontalPad,
            paddingTop: r.insets.top + 8,
            paddingBottom: 48,
          },
        ]}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={tc.primary} />
        }
        renderItem={({ item, index }) => (
          <TraceTimelineItem
            item={item}
            isFirst={index === 0}
            isLast={index === filtered.length - 1}
            onPress={() => openTrace(item)}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={tc.primary} style={{ marginTop: 32 }} />
          ) : (
            <View style={[styles.emptyBox, { borderColor: tc.borderSoft, backgroundColor: tc.card }]}>
              <Ionicons name="hardware-chip-outline" size={36} color={tc.inkMuted} />
              <Text style={[styles.emptyTitle, { color: tc.ink }]}>No agent runs yet</Text>
              <Text style={[styles.emptyBody, { color: tc.inkMuted }]}>
                Run the pipeline on the Agents tab or Operations — each step is saved here with the
                headline and decision.
              </Text>
              <Pressable
                onPress={() => rootNav.navigate("MainTabs", { screen: "Agents" })}
                style={[styles.cta, { backgroundColor: tc.primaryDark }]}
              >
                <Ionicons name="flash-outline" size={18} color="#fff" />
                <Text style={styles.ctaTxt}>Go to Agents desk</Text>
              </Pressable>
              <Pressable
                onPress={() => rootNav.navigate("Operations")}
                style={[styles.ctaSec, { borderColor: tc.tealDeep }]}
              >
                <Text style={{ color: tc.tealDeep, fontWeight: "800", fontSize: 13 }}>
                  National pipeline
                </Text>
              </Pressable>
            </View>
          )
        }
      />
    </View>
  );
}

const tl = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  rail: { width: 28, alignItems: "center" },
  line: { width: 2, minHeight: 8 },
  lineGap: { height: 8 },
  node: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  agent: { fontSize: 12, fontWeight: "900", letterSpacing: 0.3 },
  time: { marginTop: 2, fontSize: 11, fontWeight: "600" },
  conf: { fontSize: 11, fontWeight: "800" },
  title: { marginTop: 10, fontSize: 15, fontWeight: "800", lineHeight: 21 },
  sub: { marginTop: 6, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 12 },
  hint: { fontSize: 12, fontWeight: "800" },
});

const styles = StyleSheet.create({
  outer: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  title: { marginTop: 2, fontWeight: "800" },
  lead: { marginTop: 10, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryVal: { fontSize: 16, fontWeight: "900" },
  summaryLbl: { marginTop: 2, fontSize: 10, fontWeight: "700" },
  summaryDiv: { width: 1, height: 28 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: "600", paddingVertical: 8 },
  agentChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  agentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  agentChipTxt: { fontSize: 11, fontWeight: "800", maxWidth: 100 },
  countLbl: { fontSize: 11, fontWeight: "700" },
  emptyBox: {
    alignItems: "center",
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
  },
  emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: "800" },
  emptyBody: { marginTop: 8, fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 19 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  ctaTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  ctaSec: {
    marginTop: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
});
