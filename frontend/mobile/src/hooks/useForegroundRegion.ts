import * as Location from "expo-location";
import { useEffect, useState } from "react";

import {
  PAKISTAN_DEFAULT_REGION,
  PAKISTAN_OVERVIEW_REGION,
  isLatLonInPakistan,
} from "../config/pakistan";
import type { MapRegion } from "../types/map-region";

export function useForegroundRegion() {
  const [region, setRegion] = useState<MapRegion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (!cancelled) {
            setError("Location off — defaulting to Islamabad (Pakistan).");
            setRegion(PAKISTAN_DEFAULT_REGION);
          }
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        if (!cancelled) {
          if (!isLatLonInPakistan(lat, lon)) {
            setError("You appear to be outside Pakistan — showing national overview.");
            setRegion(PAKISTAN_OVERVIEW_REGION);
            return;
          }
          setRegion({
            latitude: lat,
            longitude: lon,
            latitudeDelta: 0.25,
            longitudeDelta: 0.25,
          });
        }
      } catch {
        if (!cancelled) {
          setError("Could not read location.");
          setRegion(PAKISTAN_DEFAULT_REGION);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { region, locationError: error };
}
