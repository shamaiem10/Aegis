import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

import { FalseAlarmDeskLayout } from "../components/aegis/FalseAlarmDeskLayout";

/** Tab: false-alarm verification before public alerts. */
export function FalseAlarmTabScreen() {
  const schemeDark = useColorScheme() === "dark";
  const isFocused = useIsFocused();

  return (
    <>
      {isFocused ? <StatusBar style={schemeDark ? "light" : "dark"} /> : null}
      <FalseAlarmDeskLayout />
    </>
  );
}
