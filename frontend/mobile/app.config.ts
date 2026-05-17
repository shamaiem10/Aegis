import type { ExpoConfig } from "expo/config";

const googleMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyDzisb8lb9bWtrsqu2ExChLliqvB3btGuU";

export default (): ExpoConfig => ({
  name: "Aegis",
  slug: "aegis-mobile",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "aegis",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: false,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#f8fafc",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.aegis.mobile",
    ...(googleMapsKey ? { config: { googleMapsApiKey: googleMapsKey } } : {}),
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#f8fafc",
    },
    predictiveBackGestureEnabled: false,
    package: "com.aegis.mobile",
    ...(googleMapsKey
      ? { config: { googleMaps: { apiKey: googleMapsKey } } }
      : {}),
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  extra: {
    eas: {
      projectId: "8c6914df-6b74-4235-8c4b-004debe6d59d",
    },
  },
  owner: "kiranwaqar",
  plugins: [
    "expo-font",
    [
      "expo-build-properties",
      {
        // Dev / LAN API is http:// — without this, release & dev-client Android builds often block all cleartext.
        android: { usesCleartextTraffic: true },
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Allow Aegis to use your location for regional weather (Open-Meteo) and map context.",
      },
    ],
  ],
});
