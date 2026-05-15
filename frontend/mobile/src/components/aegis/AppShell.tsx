/**
 * CIRO / Aegis UI primitives — theme-aware + responsive for mobile.
 */

import type { ReactNode } from "react";
import { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
  type ViewStyle,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useThemeCiro } from "../../theme/useThemeCiro";
import type { IonName } from "../../utils/alertIcons";

export function PageHeader({
  eyebrow,
  title,
  sub,
  right,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  const tc = useThemeCiro();
  const r = useResponsiveLayout();
  const titleSz = r.titleSize(r.isCompact ? 20 : r.isTablet ? 26 : 24);
  const subSz = r.bodySize(14);

  return (
    <View style={phStyles.wrap}>
      <View style={phStyles.main}>
        {eyebrow ? (
          <Text style={[phStyles.eyebrow, { color: tc.primaryDark }]}>{eyebrow}</Text>
        ) : null}
        <Text style={[phStyles.title, { color: tc.ink, fontSize: titleSz, lineHeight: titleSz * 1.15 }]}>{title}</Text>
        {sub ? (
          <Text
            style={[
              phStyles.sub,
              {
                color: tc.inkSoft,
                fontSize: subSz,
                lineHeight: Math.round(subSz * 1.45),
                maxWidth: r.isTablet ? 560 : undefined,
              },
            ]}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      {right ? <View style={phStyles.right}>{right}</View> : null}
    </View>
  );
}

const phStyles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  main: { flex: 1, minWidth: 0 },
  right: {},
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 6,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  sub: {
    marginTop: 6,
  },
});

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const tc = useThemeCiro();
  const r = useResponsiveLayout();
  const pad = r.isCompact ? 16 : r.isTablet ? 22 : 20;
  const rad = r.isCompact ? 20 : 24;

  return (
    <View
      style={[
        {
          borderRadius: rad,
          borderWidth: 1,
          borderColor: tc.border,
          backgroundColor: tc.card,
          padding: pad,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export type PillTone = "sky" | "mint" | "alert" | "amber" | "ink" | "teal";

export function Pill({ tone = "sky", children }: { tone?: PillTone; children: ReactNode }) {
  const tc = useThemeCiro();
  const schemeDark = useColorScheme() === "dark";
  const t = useMemo(() => {
    const map: Record<PillTone, { bg: string; text: string }> = {
      sky: { bg: tc.sky, text: tc.skyDeep },
      mint: { bg: tc.accentGreenSoft, text: tc.mintDark },
      teal: { bg: tc.tealSoft, text: tc.tealDeep },
      alert: {
        bg: schemeDark ? "rgba(248,113,113,0.2)" : "#ffe4e6",
        text: tc.alertDeep,
      },
      amber: {
        bg: schemeDark ? "rgba(251,191,36,0.2)" : tc.warnSurface,
        text: tc.amberDeep,
      },
      ink: { bg: tc.ink, text: schemeDark ? tc.canvas : "#ffffff" },
    };
    return map[tone];
  }, [tc, tone, schemeDark]);

  return (
    <View style={[pillStyles.outer, { backgroundColor: t.bg }]}>
      <Text style={[pillStyles.txt, { color: t.text }]}>{children}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  outer: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: "100%",
  },
  txt: {
    fontSize: 11,
    fontWeight: "800",
    flexShrink: 1,
  },
});

export function SeverityBar({ value }: { value: number }) {
  const tc = useThemeCiro();
  const clamped = Math.min(10, Math.max(1, value));
  const color =
    clamped >= 8 ? tc.alert : clamped >= 5 ? tc.amber : tc.accentGreen;
  const widthNum = clamped * 10;
  return (
    <View style={sevStyles.row}>
      <View style={[sevStyles.track, { backgroundColor: tc.muted }]}>
        <View style={[sevStyles.fill, { backgroundColor: color, width: `${widthNum}%` }]} />
      </View>
      <Text style={[sevStyles.label, { color: tc.ink }]}>{value}/10</Text>
    </View>
  );
}

const sevStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    minWidth: 4,
  },
  label: {
    width: 38,
    textAlign: "right",
    fontSize: 11,
    fontWeight: "700",
  },
});

export function MiniBar({
  value,
  color,
}: {
  value: number;
  color?: string;
}) {
  const tc = useThemeCiro();
  const w = Math.min(100, Math.max(0, value));
  return (
    <View style={[miniStyles.track, { backgroundColor: tc.muted }]}>
      <View
        style={[
          miniStyles.fill,
          { backgroundColor: color ?? tc.primary, width: `${w}%` },
        ]}
      />
    </View>
  );
}

const miniStyles = StyleSheet.create({
  track: {
    height: 6,
    width: "100%",
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    minWidth: 2,
  },
});

export function CiroBrandHeader() {
  const tc = useThemeCiro();
  return (
    <View style={brandStyles.row}>
      <View style={[brandStyles.logo, { backgroundColor: tc.primaryDark }]}>
        <Ionicons name="shield-checkmark" size={22} color="#fff" />
        <View style={[brandStyles.logoDot, { backgroundColor: tc.alert, borderColor: tc.card }]} />
      </View>
      <View>
        <Text style={[brandStyles.title, { color: tc.ink }]}>CIRO</Text>
        <Text style={[brandStyles.tag, { color: tc.inkSoft }]}>Aegis Control</Text>
      </View>
    </View>
  );
}

const brandStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  logoDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  title: { fontSize: 18, fontWeight: "800" },
  tag: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
});

export function SystemNominalCard() {
  const tc = useThemeCiro();
  return (
    <Card style={{ backgroundColor: tc.sky, borderColor: tc.tealSoft }}>
      <Text style={[sysStyles.sysEyebrow, { color: tc.sageDeep }]}>System</Text>
      <Text style={[sysStyles.sysTitle, { color: tc.ink }]}>All systems nominal</Text>
      <Text style={[sysStyles.sysSub, { color: tc.inkSoft }]}>Operational posture within expected bounds.</Text>
    </Card>
  );
}

const sysStyles = StyleSheet.create({
  sysEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sysTitle: { marginTop: 6, fontSize: 13, fontWeight: "800" },
  sysSub: { marginTop: 4, fontSize: 11 },
});

export function SectionCaps({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const tc = useThemeCiro();
  return (
    <Text style={[caps.text, { color: tc.inkMuted }, style]}>{children}</Text>
  );
}

const caps = StyleSheet.create({
  text: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});

export function DashboardGreeting({
  title,
  statusLabel,
  statusTone = "mint",
  onSettings,
}: {
  title: string;
  statusLabel: string;
  statusTone?: PillTone;
  onSettings?: () => void;
}) {
  const tc = useThemeCiro();
  const r = useResponsiveLayout();
  const titleSz = r.titleSize(22);

  return (
    <View style={dashGreet.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[dashGreet.kicker, { color: tc.inkSoft, fontSize: r.bodySize(12) }]}>Good morning</Text>
        <Text style={[dashGreet.title, { color: tc.ink, fontSize: titleSz, lineHeight: titleSz * 1.2 }]}>{title}</Text>
      </View>
      <Pill tone={statusTone}>{statusLabel}</Pill>
      {onSettings ? (
        <Pressable
          onPress={onSettings}
          style={({ pressed }) => [
            dashGreet.gear,
            {
              backgroundColor: tc.muted,
              borderColor: tc.border,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Ionicons name="settings-outline" size={22} color={tc.inkSoft} />
        </Pressable>
      ) : null}
    </View>
  );
}

const dashGreet = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  kicker: {
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  title: {
    marginTop: 4,
    fontWeight: "800",
    letterSpacing: -0.6,
    maxWidth: "100%",
  },
  gear: {
    marginLeft: 4,
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});

export function MapCardChrome({
  eyebrow,
  title,
  hint,
  onZoomIn,
  onZoomOut,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}) {
  const tc = useThemeCiro();
  const r = useResponsiveLayout();
  const btn = r.isCompact ? 44 : 46;

  return (
    <View style={mapChrome.top}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[mapChrome.eyebrow, { color: tc.primary }]}>{eyebrow}</Text>
        <Text style={[mapChrome.title, { color: tc.ink, fontSize: r.isCompact ? 15 : 16 }]}>{title}</Text>
        {hint ? (
          <Text style={[mapChrome.hint, { color: tc.inkMuted, fontSize: r.bodySize(11) }]}>{hint}</Text>
        ) : null}
      </View>
      <View style={mapChrome.zoomCol}>
        <Pressable
          onPress={onZoomIn}
          style={({ pressed }) => [
            mapChrome.zoomBtn,
            {
              width: btn,
              height: btn,
              backgroundColor: tc.card,
              borderColor: tc.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Zoom in map"
        >
          <Text style={[mapChrome.zoomTxt, { color: tc.ink }]}>+</Text>
        </Pressable>
        <Pressable
          onPress={onZoomOut}
          style={({ pressed }) => [
            mapChrome.zoomBtn,
            {
              width: btn,
              height: btn,
              backgroundColor: tc.card,
              borderColor: tc.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Zoom out map"
        >
          <Text style={[mapChrome.zoomTxt, { color: tc.ink }]}>−</Text>
        </Pressable>
      </View>
    </View>
  );
}

const mapChrome = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 6,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  hint: {
    marginTop: 8,
    lineHeight: 16,
    fontWeight: "600",
  },
  zoomCol: { gap: 8 },
  zoomBtn: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    borderWidth: 1,
  },
  zoomTxt: { fontSize: 20, fontWeight: "700", marginTop: -2 },
});

export function KpiTile({
  label,
  value,
  hint,
  hintTone = "muted",
  iconName,
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  hintTone?: "muted" | "green" | "red";
  iconName?: IonName;
  trend?: string;
}) {
  const tc = useThemeCiro();
  const r = useResponsiveLayout();
  const hintColor =
    hintTone === "green" ? tc.sageDeep : hintTone === "red" ? tc.alertDeep : tc.inkSoft;
  const valueSz = r.isCompact ? 22 : r.isTablet ? 28 : 26;

  return (
    <View
      style={[
        kpi.wrap,
        {
          backgroundColor: tc.card,
          borderColor: tc.borderSoft,
          minHeight: r.isCompact ? 112 : 124,
          paddingVertical: r.isCompact ? 12 : 14,
          paddingHorizontal: r.isCompact ? 10 : 12,
        },
      ]}
    >
      <View style={kpi.labelRow}>
        {iconName ? (
          <Ionicons name={iconName} size={r.isCompact ? 16 : 18} color={tc.primaryDark} style={kpi.leadIcon} />
        ) : null}
        <Text style={[kpi.label, { color: tc.inkMuted, fontSize: r.bodySize(10) }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <View style={kpi.valueRow}>
        <Text
          style={[kpi.value, { color: tc.ink, fontSize: valueSz }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {value}
        </Text>
        {trend ? (
          <Text style={[kpi.trend, { color: tc.accentGreen, fontSize: r.bodySize(12) }]}>{trend}</Text>
        ) : null}
      </View>
      {hint ? (
        <Text style={[kpi.hint, { color: hintColor, fontSize: r.bodySize(12) }]} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const kpi = StyleSheet.create({
  wrap: {
    width: "100%",
    minWidth: 96,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  leadIcon: { marginRight: 0 },
  label: {
    flex: 1,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  valueRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "wrap",
  },
  value: {
    fontWeight: "800",
    letterSpacing: -1,
    flexShrink: 1,
  },
  trend: {
    fontWeight: "900",
  },
  hint: {
    marginTop: 6,
    fontWeight: "700",
  },
});

export type AlertPriority = "HIGH" | "MED" | "LOW";

export function AlertPreviewRow({
  iconName,
  iconTint,
  title,
  timeLabel,
  priority,
  onPress,
}: {
  iconName: IonName;
  iconTint?: string;
  title: string;
  timeLabel: string;
  priority: AlertPriority;
  onPress?: () => void;
}) {
  const tc = useThemeCiro();
  const r = useResponsiveLayout();
  const schemeDark = useColorScheme() === "dark";

  const pri =
    priority === "HIGH"
      ? {
          bg: schemeDark ? "rgba(248,113,113,0.2)" : "#ffe4e6",
          fg: tc.alertDeep,
          t: "HIGH" as const,
        }
      : priority === "MED"
        ? {
            bg: schemeDark ? "rgba(251,191,36,0.18)" : tc.warnSurface,
            fg: tc.amberDeep,
            t: "MED" as const,
          }
        : { bg: tc.muted, fg: tc.inkSoft, t: "LOW" as const };
  const blobBg = iconTint ?? tc.sky;

  const Inner = (
    <View style={[apr.row, { minHeight: 56 }]}>
      <View style={[apr.iconBlob, { backgroundColor: blobBg }]}>
        <Ionicons name={iconName} size={r.isCompact ? 20 : 22} color={tc.primaryDark} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[apr.title, { color: tc.ink, fontSize: r.bodySize(15) }]} numberOfLines={3}>
          {title}
        </Text>
        <Text style={[apr.time, { color: tc.inkMuted, fontSize: r.bodySize(12) }]} numberOfLines={2}>
          {timeLabel}
        </Text>
      </View>
      <View style={[apr.badge, { backgroundColor: pri.bg }]}>
        <Text style={[apr.badgeTxt, { color: pri.fg }]}>{pri.t}</Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          apr.card,
          {
            borderColor: tc.border,
            backgroundColor: tc.card,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
        android_ripple={{ color: tc.muted }}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityHint="Opens alert details"
      >
        {Inner}
      </Pressable>
    );
  }
  return (
    <View
      style={[
        apr.card,
        {
          borderColor: tc.border,
          backgroundColor: tc.card,
        },
      ]}
    >
      {Inner}
    </View>
  );
}

const apr = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBlob: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: { fontWeight: "700", letterSpacing: -0.2 },
  time: { marginTop: 4, fontWeight: "600" },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    flexShrink: 0,
  },
  badgeTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
});

export function SourcePill({ iconName, label }: { iconName: IonName; label: string }) {
  const tc = useThemeCiro();
  return (
    <View style={[sp.row, { backgroundColor: tc.muted, borderColor: tc.border }]}>
      <Ionicons name={iconName} size={15} color={tc.primaryDark} />
      <Text style={[sp.lbl, { color: tc.ink }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const sp = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: "100%",
  },
  lbl: { fontSize: 11, fontWeight: "700", flex: 1 },
});

export function ConfidenceBar({ value }: { value: number }) {
  const tc = useThemeCiro();
  const pct = Math.min(100, Math.max(0, value));
  return (
    <View style={cb.wrap}>
      <View style={cb.top}>
        <Text style={[cb.lbl, { color: tc.inkSoft }]}>CONFIDENCE</Text>
        <Text style={[cb.pct, { color: tc.alertDeep }]}>{pct}%</Text>
      </View>
      <View style={[cb.track, { backgroundColor: tc.muted }]}>
        <View style={[cb.fill, { width: `${pct}%`, backgroundColor: tc.alert }]} />
      </View>
    </View>
  );
}

const cb = StyleSheet.create({
  wrap: { marginTop: 12 },
  top: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  lbl: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  pct: { fontSize: 14, fontWeight: "800" },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
});

export function ActionFooter({
  secondaryLabel,
  secondaryIconName = "search-outline",
  onSecondary,
  primaryLabel,
  primaryIconName = "flash-outline",
  onPrimary,
}: {
  secondaryLabel: string;
  secondaryIconName?: IonName;
  onSecondary?: () => void;
  primaryLabel: string;
  primaryIconName?: IonName;
  onPrimary?: () => void;
}) {
  const tc = useThemeCiro();
  const r = useResponsiveLayout();
  const padV = r.isCompact ? 12 : 14;

  return (
    <View style={[af.row, { flexWrap: r.width < 340 ? "wrap" : "nowrap", gap: 10 }]}>
      <Pressable
        onPress={onSecondary}
        style={({ pressed }) => [
          af.outline,
          {
            borderColor: tc.border,
            backgroundColor: tc.card,
            paddingVertical: padV,
            flexBasis: r.width < 340 ? "100%" : undefined,
            opacity: pressed ? 0.88 : 1,
          },
        ]}
        accessibilityRole="button"
      >
        <Ionicons name={secondaryIconName} size={22} color={tc.ink} />
        <Text style={[af.outTxt, { color: tc.ink, fontSize: r.bodySize(14) }]}>{secondaryLabel}</Text>
      </Pressable>
      <Pressable
        onPress={onPrimary}
        style={({ pressed }) => [
          af.solid,
          {
            backgroundColor: tc.alert,
            paddingVertical: padV,
            flexBasis: r.width < 340 ? "100%" : undefined,
            shadowColor: tc.alertDeep,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
        accessibilityRole="button"
      >
        <Ionicons name={primaryIconName} size={22} color="#fff" />
        <Text style={[af.solTxt, { fontSize: r.bodySize(14) }]}>{primaryLabel}</Text>
      </Pressable>
    </View>
  );
}

const af = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginTop: 20,
  },
  outline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 2,
  },
  outTxt: { fontWeight: "800" },
  solid: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 48,
    borderRadius: 16,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  solTxt: { fontWeight: "800", color: "#fff" },
});

export function GradientHeroCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const tc = useThemeCiro();
  const r = useResponsiveLayout();

  return (
    <LinearGradient
      colors={[tc.heroGradStart, tc.heroGradEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          borderRadius: r.isCompact ? 22 : 26,
          padding: r.isCompact ? 16 : 20,
          borderWidth: 1,
          borderColor: tc.border,
          marginBottom: 16,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </LinearGradient>
  );
}

export function ReasoningBullet({ children }: { children: ReactNode }) {
  const tc = useThemeCiro();
  return (
    <View style={rb.row}>
      <View style={[rb.dot, { backgroundColor: tc.primary }]} />
      <Text style={[rb.txt, { color: tc.inkSoft }]}>{children}</Text>
    </View>
  );
}

const rb = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, marginBottom: 10, alignItems: "flex-start" },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  txt: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
});
