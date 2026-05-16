import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  Switch,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import {
  defaultApiBase,
  fetchHealth,
  getApiBase,
  getDemoModeResolved,
  resetBundledDemoData,
  saveApiBase,
  saveDemoMode,
  apiHostLooksLikeMeshOrVpn,
} from "../api/client";
import { DEFAULT_BACKEND_PORT } from "../config/backendDefaults";
import { useAegisUi } from "../hooks/useAegisUi";
import { useThemeCiro } from "../theme/useThemeCiro";

function explicitUrlPort(url: string): number | null {
  try {
    const trimmed = url.trim();
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    const u = new URL(normalized);
    return u.port ? Number(u.port) : null;
  } catch {
    return null;
  }
}

function rewriteUrlPort(url: string, port: number): string | null {
  try {
    const trimmed = url.trim();
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    const u = new URL(normalized);
    u.port = String(port);
    const out = `${u.origin}`;
    return out.replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** Local Cloud Run Express (`npm run dev` in `cloud-run/`). */
const LOCAL_CLOUD_RUN_PORT = 8080;

function backendPortLooksUnusual(port: number | null): port is number {
  return port !== null && port !== DEFAULT_BACKEND_PORT && port !== LOCAL_CLOUD_RUN_PORT;
}

export function SettingsScreen() {
  const { tc, r, contentWrap } = useAegisUi();
  const styles = useMemo(() => createStyles(tc), [tc]);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  const sync = useCallback(async () => {
    const b = await getApiBase();
    setDraft(b);
    setDemo(await getDemoModeResolved());
  }, []);

  useEffect(() => {
    void sync();
  }, [sync]);

  useFocusEffect(
    useCallback(() => {
      void sync();
    }, [sync]),
  );

  const toggleDemo = async (value: boolean) => {
    await saveDemoMode(value);
    setDemo(value);
    setMsg(value ? "Offline demo on — no server required." : "Live API mode — set URL below.");
  };

  const save = async () => {
    await saveApiBase(draft);
    const url = draft.trim().toLowerCase();
    if (
      Platform.OS === "android" &&
      (url.includes("10.0.2.2") || url.includes("localhost") || url.includes("127.0.0.1"))
    ) {
      setMsg(
        "Checking… (Note: 10.0.2.2 / localhost only work on an Android emulator, not on a real phone.)",
      );
    } else {
      setMsg("Saved. Pinging…");
    }
    try {
      const h = await fetchHealth();
      setMsg(`Backend reachable (${h.status})`);
    } catch (e) {
      setMsg(`Saved but ping failed: ${String((e as Error).message)}`);
    }
  };

  return (
    <ScrollView
      style={styles.wrap}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        contentWrap,
        {
          paddingHorizontal: r.horizontalPad,
          paddingTop: r.insets.top + 12,
          paddingBottom: 40,
        },
      ]}
    >
      <Text style={styles.h1}>Data source</Text>
      <View style={styles.row}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.rowTitle}>Offline demo</Text>
          <Text style={styles.rowSub}>
            APK works out of the box with bundled dossiers. Turn off to use your FastAPI server.
          </Text>
        </View>
        <Switch value={demo} onValueChange={(v) => void toggleDemo(v)} />
      </View>

      <Pressable
        onPress={() => {
          resetBundledDemoData();
          setMsg("Demo dossiers reset to factory sample data.");
        }}
        style={[styles.secondaryBtn, { marginTop: 8 }]}
      >
        <Text style={styles.secondaryLbl}>Reset demo dossiers</Text>
      </Pressable>

      <Text style={[styles.h1, { marginTop: 28 }]}>Backend URL</Text>
      <Text style={styles.sub}>
        <Text style={styles.bold}>Physical phone:</Text> use your PC&apos;s{" "}
        <Text style={styles.bold}>Wi‑Fi IPv4</Text> (PowerShell:{" "}
        <Text style={styles.monoInline}>ipconfig</Text> → &quot;Wireless LAN adapter Wi-Fi&quot;). Avoid{" "}
        <Text style={styles.monoInline}>10.7.x.x</Text> / Tailscale-only IPs unless the phone is on the same
        VPN — use <Text style={styles.monoInline}>192.168.x.x</Text>-style LAN when both are on home Wi‑Fi.
        Emulator only: <Text style={styles.monoInline}>10.0.2.2</Text>. Match{" "}
        <Text style={styles.bold}>PORT</Text> in <Text style={styles.monoInline}>backend/.env</Text> (default{" "}
        <Text style={styles.bold}>{DEFAULT_BACKEND_PORT}</Text>). Run backend:{" "}
        <Text style={styles.monoInline}>python -m uvicorn main:app --host 0.0.0.0 --port {DEFAULT_BACKEND_PORT}</Text>{" "}
        or <Text style={styles.monoInline}>.\run-dev.ps1</Text> in the backend folder.
      </Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={`http://YOUR_LAN_IP:${DEFAULT_BACKEND_PORT}`}
        editable={!demo}
        style={[styles.input, demo && styles.inputDisabled]}
      />
      {!demo && /10\.0\.2\.2|127\.0\.0\.1|localhost/i.test(draft) && Platform.OS === "android" ? (
        <View style={styles.warnBox}>
          <Text style={styles.warnTitle}>Wrong URL for a physical device</Text>
          <Text style={styles.warnTxt}>
            Replace this with your computer&apos;s LAN address (ipconfig → IPv4). 10.0.2.2 is only for the
            emulator.
          </Text>
        </View>
      ) : null}
      {!demo && apiHostLooksLikeMeshOrVpn(draft) ? (
        <View style={[styles.warnBox, { marginTop: 10 }]}>
          <Text style={styles.warnTitle}>This URL often fails on normal Wi‑Fi</Text>
          <Text style={styles.warnTxt}>
            10.7.x.x / many 100.x.x.x addresses are mesh/VPN (e.g. Tailscale). Your phone must join the same VPN,
            or change the URL to your real Wi‑Fi IPv4 from ipconfig (usually 192.168.x.x).
          </Text>
        </View>
      ) : null}
      {!demo && draft.includes(":8000") ? (
        <View style={[styles.warnBox, { marginTop: 10, borderColor: tc.alert }]}>
          <Text style={[styles.warnTitle, { color: tc.alertDeep }]}>AI agents need port 8080</Text>
          <Text style={styles.warnTxt}>
            This URL uses FastAPI port 8000. Triage and action plans call cloud-run on port 8080.
          </Text>
          <Pressable
            onPress={() => {
              const next = rewriteUrlPort(draft, LOCAL_CLOUD_RUN_PORT);
              if (next) {
                setDraft(next);
                void saveApiBase(next).then(() => setMsg("Switched to port 8080 (cloud-run)."));
              }
            }}
            style={[styles.portBtn, { marginTop: 10 }]}
          >
            <Text style={styles.portBtnLbl}>Switch to port 8080 & save</Text>
          </Pressable>
        </View>
      ) : null}
      {!demo && backendPortLooksUnusual(explicitUrlPort(draft)) ? (
        <View style={styles.portBox}>
          <Text style={styles.portTitle}>Unusual port</Text>
          <Text style={styles.portTxt}>
            This URL uses port {explicitUrlPort(draft)}. FastAPI in{" "}
            <Text style={styles.monoInline}>backend/</Text> expects{" "}
            <Text style={styles.bold}>{DEFAULT_BACKEND_PORT}</Text> (<Text style={styles.monoInline}>PORT</Text> in{" "}
            <Text style={styles.monoInline}>backend/.env</Text>); local Express in{" "}
            <Text style={styles.monoInline}>cloud-run/</Text> often{" "}
            <Text style={styles.bold}>{LOCAL_CLOUD_RUN_PORT}</Text>.
          </Text>
          <Pressable
            onPress={() => {
              const next = rewriteUrlPort(draft, DEFAULT_BACKEND_PORT);
              if (next) setDraft(next);
            }}
            style={styles.portBtn}
          >
            <Text style={styles.portBtnLbl}>Use port {DEFAULT_BACKEND_PORT} (FastAPI)</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const next = rewriteUrlPort(draft, LOCAL_CLOUD_RUN_PORT);
              if (next) setDraft(next);
            }}
            style={[styles.portBtn, { marginTop: 10 }]}
          >
            <Text style={styles.portBtnLbl}>Use port {LOCAL_CLOUD_RUN_PORT} (Cloud Run dev)</Text>
          </Pressable>
        </View>
      ) : null}
      <TouchableOpacity
        onPress={() => {
          console.log("Save button tapped");
          void save();
        }}
        disabled={demo}
        activeOpacity={0.7}
        style={[styles.btn, demo && { opacity: 0.45 }]}
      >
        <Text style={styles.btnLbl}>Save & ping /health</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          setDraft(defaultApiBase());
        }}
        activeOpacity={0.7}
        style={styles.link}
      >
        <Text style={styles.linkLbl}>Reset URL to default ({defaultApiBase()})</Text>
      </TouchableOpacity>

      <Text style={[styles.h1, { marginTop: 28 }]}>Environmental thresholds</Text>
      <Text style={styles.sub}>
        AQI advisory default 150 · mandatory alert 200. Dust storm confidence 70%. Cross-reference heat + AQI (compound
        risk) is ON by default.
      </Text>
      <View style={styles.row}>
        <Text style={styles.rowTitle}>Auto health advisory AQI &gt; 200</Text>
        <Switch value={false} disabled />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowTitle}>Auto pre-position forecast crises</Text>
        <Switch value={true} />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowTitle}>Heat + AQI compound detection</Text>
        <Switch value={true} />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowTitle}>AQI heatmap on map by default</Text>
        <Switch value={true} />
      </View>

      <Text style={[styles.h1, { marginTop: 28 }]}>Installable APK</Text>
      <Text style={styles.sub}>
        From this folder: run `npx eas-cli build --platform android --profile preview` after `npx eas-cli
        login` and `eas init` (once). Download the APK from the Expo dashboard and sideload or distribute
        internally.
      </Text>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
    </ScrollView>
  );
}

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: tc.background },
    h1: { fontSize: 22, fontWeight: "800", color: tc.ink },
    sub: { fontSize: 13, color: tc.inkSoft, marginTop: 8, marginBottom: 12, lineHeight: 18 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 12,
      backgroundColor: tc.card,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: tc.border,
    },
    rowTitle: { fontSize: 15, fontWeight: "700", color: tc.ink },
    rowSub: { fontSize: 12, color: tc.inkSoft, marginTop: 6, lineHeight: 16 },
    input: {
      backgroundColor: tc.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: tc.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: tc.ink,
    },
    inputDisabled: { opacity: 0.55, backgroundColor: tc.muted },
    btn: {
      marginTop: 14,
      backgroundColor: tc.ink,
      paddingVertical: 14,
      borderRadius: 999,
      alignItems: "center",
    },
    btnLbl: { color: "#fff", fontWeight: "800" },
    secondaryBtn: {
      alignSelf: "flex-start",
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: tc.muted,
    },
    secondaryLbl: { fontSize: 12, fontWeight: "600", color: tc.inkSoft },
    link: { marginTop: 12, alignItems: "center" },
    linkLbl: { color: tc.primary, fontWeight: "600", fontSize: 14 },
    msg: { marginTop: 16, fontSize: 13, color: tc.inkSoft },
    bold: { fontWeight: "700", color: tc.ink },
    monoInline: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontWeight: "600",
      fontSize: 13,
      color: tc.inkMuted,
    },
    warnBox: {
      backgroundColor: tc.warnSurface,
      borderWidth: 1,
      borderColor: tc.amber,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
    },
    warnTitle: { fontWeight: "800", color: tc.amberDeep, marginBottom: 6 },
    warnTxt: { fontSize: 13, color: tc.ink, lineHeight: 18 },
    portBox: {
      backgroundColor: tc.cardTint,
      borderWidth: 1,
      borderColor: tc.border,
      borderRadius: 12,
      padding: 12,
      marginTop: 10,
      marginBottom: 10,
    },
    portTitle: { fontWeight: "800", color: tc.alertDeep, marginBottom: 6 },
    portTxt: { fontSize: 13, color: tc.inkSoft, lineHeight: 18, marginBottom: 10 },
    portBtn: {
      alignSelf: "flex-start",
      backgroundColor: tc.primaryDark,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 999,
    },
    portBtnLbl: { color: "#fff", fontWeight: "800", fontSize: 13 },
  });
}
