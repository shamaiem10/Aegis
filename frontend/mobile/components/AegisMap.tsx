import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import type { MapRegion } from "../src/types/map-region";

type Props = {
  region: MapRegion | null;
  latitudeDelta?: number;
  longitudeDelta?: number;
  /** Google Maps traffic overlay (congestion colouring — not per-crash incidents). */
  showsTraffic?: boolean;
};

export function AegisMap({
  region,
  latitudeDelta = 0.05,
  longitudeDelta,
  showsTraffic = true,
}: Props) {
  if (!region) {
    return <ActivityIndicator size="large" style={styles.fill} />;
  }

  const dLat = latitudeDelta;
  const dLon = longitudeDelta ?? latitudeDelta;

  return (
    <View style={styles.fill}>
      <MapView
        style={styles.fill}
        mapType="standard"
        showsTraffic={showsTraffic}
        initialRegion={{
          latitude: region.latitude,
          longitude: region.longitude,
          latitudeDelta: dLat,
          longitudeDelta: dLon,
        }}
        region={{
          latitude: region.latitude,
          longitude: region.longitude,
          latitudeDelta: dLat,
          longitudeDelta: dLon,
        }}
      >
        <Marker
          coordinate={{ latitude: region.latitude, longitude: region.longitude }}
          title="Map focus"
          description="Your location or Pakistan default"
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
