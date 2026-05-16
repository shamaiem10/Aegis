import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import {
  EMPTY_LIVE_ENV_INDEX,
  fetchPakistanLiveEnvIndex,
  nearestPakistanEnvCity,
  type PakistanEnvCityKey,
  type PakistanLiveEnvSnapshot,
} from "../api/pakistanEnvLive";

export function usePakistanEnvRiskIndex(gps?: { lat: number; lon: number } | null): {
  envIndex: PakistanLiveEnvSnapshot;
  loading: boolean;
  selectedCity: PakistanEnvCityKey;
  setSelectedCity: (key: PakistanEnvCityKey) => void;
  refresh: () => void;
} {
  const [selectedCity, setSelectedCity] = useState<PakistanEnvCityKey>("all");
  const [envIndex, setEnvIndex] = useState<PakistanLiveEnvSnapshot>(EMPTY_LIVE_ENV_INDEX);
  const [loading, setLoading] = useState(true);
  const gpsBootstrapped = useRef(false);

  useEffect(() => {
    if (gpsBootstrapped.current || !gps) return;
    const key = nearestPakistanEnvCity(gps.lat, gps.lon);
    if (key !== "all") {
      gpsBootstrapped.current = true;
      setSelectedCity(key);
    }
  }, [gps]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await fetchPakistanLiveEnvIndex(selectedCity);
      setEnvIndex(snap);
    } catch {
      setEnvIndex({ ...EMPTY_LIVE_ENV_INDEX, selectedCity });
    } finally {
      setLoading(false);
    }
  }, [selectedCity]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return {
    envIndex,
    loading,
    selectedCity,
    setSelectedCity,
    refresh: () => void load(),
  };
}
