import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

import { ReportsDesk } from "../components/aegis/ReportsDesk";

/** Tab: stakeholder alert approvals + pipeline outcome summary. */
export function ReportsTabScreen() {
  const schemeDark = useColorScheme() === "dark";
  const isFocused = useIsFocused();

  return (
    <>
      {isFocused ? <StatusBar style={schemeDark ? "light" : "dark"} /> : null}
      <ReportsDesk />
    </>
  );
}
