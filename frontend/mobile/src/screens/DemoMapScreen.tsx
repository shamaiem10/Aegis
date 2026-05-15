import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, ActivityIndicator, ScrollView } from "react-native";
import MapView, { Circle, Marker, Polygon, Polyline } from "react-native-maps";

import { listSignals } from "../api/client";
import type { SignalApi } from "../api/types";
import { PageHeader, Pill } from "../components/aegis/AppShell";
import { useAegisUi } from "../hooks/useAegisUi";
import { signalListKey } from "../utils/signalListKey";
import { getAQIColor } from "../utils/aqi";
import { useColorScheme } from "react-native";
import { useThemeCiro } from "../theme/useThemeCiro";

const ISB = {
  latitude: 33.7095,
  longitude: 73.0421,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const SENSORS = [
  { id: "F7-01", lat: 33.7089, lng: 73.0412, aqi: 241 },
  { id: "F7-02", lat: 33.7102, lng: 73.0389, aqi: 287 },
  { id: "F7-03", lat: 33.7071, lng: 73.0441, aqi: 263 },
  { id: "G7-01", lat: 33.7198, lng: 73.0301, aqi: 174 },
];

export function DemoMapScreen() {
  const { tc, r, contentWrap } = useAegisUi();
  const styles = useMemo(() => createStyles(tc), [tc]);
  const schemeDark = useColorScheme() === "dark";
  const [data, setData] = useState<SignalApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [layers, setLayers] = useState({
    heatmap: true,
    plume: true,
    dust: true,
    sensors: true,
    health: true,
  });
  const [plumeNudge, setPlumeNudge] = useState(0);
  const [plumeLabelSec, setPlumeLabelSec] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    listSignals()
      .then((res) => setData(res))
      .catch((e) => console.warn(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    tickRef.current = setInterval(() => {
      setPlumeNudge((n) => n + 1);
      setPlumeLabelSec(0);
    }, 10_000);
    const sec = setInterval(() => setPlumeLabelSec((s) => (s + 1) % 60), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      clearInterval(sec);
    };
  }, []);

  const plumeBase = [
    { latitude: 33.706 + plumeNudge * 0.00015, longitude: 73.038 },
    { latitude: 33.712 + plumeNudge * 0.0001, longitude: 73.045 },
    { latitude: 33.704 + plumeNudge * 0.0001, longitude: 73.048 },
    { latitude: 33.702, longitude: 73.04 },
  ];

  const dustPath = [
    { latitude: 33.52, longitude: 72.95 },
    { latitude: 33.58, longitude: 73.02 },
    { latitude: 33.62, longitude: 73.08 },
  ];

  const healthZone = [
    { latitude: 33.712, longitude: 73.036 },
    { latitude: 33.715, longitude: 73.048 },
    { latitude: 33.705, longitude: 73.052 },
    { latitude: 33.703, longitude: 73.038 },
  ];

  return (
    <View style={styles.wrap}>
      <View style={[contentWrap, { paddingHorizontal: r.horizontalPad, paddingTop: r.insets.top + 12, paddingBottom: 8 }]}>
        <PageHeader
          eyebrow="Islamabad AOI"
          title="Environmental map"
          sub="AQI heatmap, plume, dust corridor, sensors. Plume edge advances every 10s (sim)."
          right={<Pill tone="amber">{loading ? "Loading..." : `${data.length} signals`}</Pill>}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.layerRow, { paddingHorizontal: r.horizontalPad }]}
      >
        {(
          [
            ["heatmap", "AQI heat"] as const,
            ["plume", "Plume"] as const,
            ["dust", "Dust path"] as const,
            ["sensors", "Sensors"] as const,
            ["health", "Health zone"] as const,
          ] as const
        ).map(([key, label]) => {
          const on = layers[key as keyof typeof layers];
          return (
            <Pressable
              key={key}
              onPress={() => setLayers((l) => ({ ...l, [key]: !l[key as keyof typeof layers] }))}
              style={[styles.layerChip, on && styles.layerChipOn]}
            >
              <Text style={[styles.layerChipTxt, on && styles.layerChipTxtOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.mapContainer, { marginHorizontal: r.horizontalPad }]}>
        {loading ? (
          <ActivityIndicator size="large" style={{ marginTop: 40 }} />
        ) : (
          <MapView
            style={StyleSheet.absoluteFillObject}
            mapType="standard"
            showsTraffic
            initialRegion={ISB}
          >
            {layers.health ? (
              <Polygon
                coordinates={healthZone}
                strokeColor="#dc262688"
                fillColor="#dc262633"
                strokeWidth={2}
              />
            ) : null}
            {layers.heatmap ? (
              <Circle
                center={{ latitude: 33.7095, longitude: 73.0421 }}
                radius={2100}
                strokeColor="#7c3aed"
                fillColor="#7c3aed44"
              />
            ) : null}
            {layers.plume ? (
              <>
                <Polygon
                  coordinates={plumeBase}
                  strokeColor="#7c3aed"
                  fillColor="#a78bfa55"
                  strokeWidth={2}
                />
                <Polyline
                  coordinates={[
                    { latitude: 33.715, longitude: 73.03 },
                    { latitude: 33.702, longitude: 73.05 },
                  ]}
                  strokeColor="#7c3aed"
                  strokeWidth={3}
                />
              </>
            ) : null}
            {layers.dust ? (
              <Polyline coordinates={dustPath} strokeColor="#f59e0b" strokeWidth={5} lineDashPattern={[12, 10]} />
            ) : null}
            {layers.sensors
              ? SENSORS.map((s) => (
                  <Marker
                    key={s.id}
                    coordinate={{ latitude: s.lat, longitude: s.lng }}
                    pinColor={getAQIColor(s.aqi, schemeDark)}
                    title={`AQI-${s.id}`}
                    description={`AQI ${s.aqi} · PM live`}
                  />
                ))
              : null}
            {data.map((c, i) => (
              <Marker
                key={signalListKey(c, i)}
                coordinate={{ latitude: c.lat, longitude: c.lon }}
                title={c.text.slice(0, 60)}
                description={`Severity: ${c.severity_hint}`}
              />
            ))}
          </MapView>
        )}
        <View style={[styles.mapOverlay, { backgroundColor: schemeDark ? `${tc.card}f0` : `${tc.card}ee` }]}>
          <Text style={styles.overlayTxt}>
            AQI 287 · Plume advancing — updated {plumeLabelSec}s ago
          </Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: tc.background },
    layerRow: { gap: 8, paddingBottom: 10 },
    layerChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: tc.card,
      borderWidth: 1,
      borderColor: tc.border,
      marginRight: 8,
    },
    layerChipOn: { backgroundColor: tc.tealSoft, borderColor: tc.tealDeep },
    layerChipTxt: { fontSize: 11, fontWeight: "800", color: tc.inkMuted },
    layerChipTxtOn: { color: tc.tealDeep },
    mapContainer: {
      flex: 1,
      borderRadius: 20,
      overflow: "hidden",
      marginBottom: 24,
      borderWidth: 1,
      borderColor: tc.border,
    },
    mapOverlay: {
      position: "absolute",
      bottom: 12,
      left: 12,
      right: 12,
      padding: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tc.borderSoft,
    },
    overlayTxt: { fontSize: 11, fontWeight: "800", color: tc.ink },
  });
}
