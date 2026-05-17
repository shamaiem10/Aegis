import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

import { EmergencyResourcesDesk } from "../components/aegis/EmergencyResourcesDesk";

/** Stack: Islamabad emergency inventory (police, hospitals, EMS, OSM). */
export function EmergencyResourcesScreen() {
  const schemeDark = useColorScheme() === "dark";
  const isFocused = useIsFocused();

  return (
    <>
      {isFocused ? <StatusBar style={schemeDark ? "light" : "dark"} /> : null}
      <EmergencyResourcesDesk />
    </>
  );
}
