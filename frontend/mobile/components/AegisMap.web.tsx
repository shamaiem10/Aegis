import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import type { MapRegion } from "../src/types/map-region";

type Props = {
  region: MapRegion | null;
};

/**
 * Web preview uses a placeholder instead of embedded Google Maps.
 */
export function AegisMap({ region }: Props) {
  if (!region) {
    return <ActivityIndicator size="large" style={styles.fill} />;
  }
  const lat = region.latitude.toFixed(4);
  const lon = region.longitude.toFixed(4);
  return (
    <View style={styles.placeholder}>
      <Text style={styles.coords}>
        {lat}°, {lon}°
      </Text>
      <Text style={styles.placeholderText}>
        Web preview: map tiles are disabled. On Android/iOS (Expo or APK), add
        EXPO_PUBLIC_GOOGLE_MAPS_API_KEY and a maps-enabled dev build when ready.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  coords: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 12,
  },
  placeholderText: {
    textAlign: "center",
    color: "#475569",
    fontSize: 14,
  },
});
