import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

import { SimulationDesk } from "../components/aegis/SimulationDesk";

/** Tab: model response actions before deploying real resources. */
export function SimulationTabScreen() {
  const schemeDark = useColorScheme() === "dark";
  const isFocused = useIsFocused();

  return (
    <>
      {isFocused ? <StatusBar style={schemeDark ? "light" : "dark"} /> : null}
      <SimulationDesk />
    </>
  );
}
