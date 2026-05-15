import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";

import { OPEN_METEO_FORECAST } from "../config/endpoints";
import { PAKISTAN_TIMEZONE } from "../config/pakistan";
import { useForegroundRegion } from "../hooks/useForegroundRegion";
import { useAegisUi } from "../hooks/useAegisUi";
import { useThemeCiro } from "../theme/useThemeCiro";

export function WeatherScreen() {
  const { tc, r, contentWrap } = useAegisUi();
  const styles = useMemo(() => createStyles(tc), [tc]);
  const { region, locationError } = useForegroundRegion();
  const [json, setJson] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!region) return;
    let cancelled = false;
    const u = new URL(OPEN_METEO_FORECAST);
    u.searchParams.set("latitude", String(region.latitude));
    u.searchParams.set("longitude", String(region.longitude));
    u.searchParams.set("current_weather", "true");
    u.searchParams.set("timezone", "auto");
    (async () => {
      try {
        const r = await fetch(u.toString());
        const j = await r.json();
        const cw = j.current_weather;
        if (!cancelled) setJson(JSON.stringify(cw ?? j, null, 2));
      } catch (e) {
        if (!cancelled) setErr(String((e as Error).message));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [region]);

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={[
        contentWrap,
        {
          paddingHorizontal: r.horizontalPad,
          paddingTop: r.insets.top + 12,
          paddingBottom: 32,
        },
      ]}
    >
      <Text style={styles.h1}>Pakistan weather snapshot</Text>
      <Text style={styles.sub}>
        Open‑Meteo at your map pin (Pakistan-default if GPS off). Timezone locked to {PAKISTAN_TIMEZONE}.
      </Text>
      {locationError ? <Text style={styles.warn}>{locationError}</Text> : null}
      {!region ? <ActivityIndicator color={tc.primary} /> : null}
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {json ? <Text style={styles.mono}>{json}</Text> : null}
    </ScrollView>
  );
}

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: tc.canvas },
    h1: { fontSize: 20, fontWeight: "800", color: tc.ink },
    sub: { marginTop: 6, fontSize: 13, color: tc.inkSoft },
    mono: {
      marginTop: 16,
      fontSize: 11,
      color: tc.inkMuted,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    err: { color: tc.alertDeep, marginTop: 10 },
    warn: { color: tc.amberDeep, marginTop: 8 },
  });
}
