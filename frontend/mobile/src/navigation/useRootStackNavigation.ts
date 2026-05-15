import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "./types";

/** Tab screens live under `MainTabs`; stack routes are on the parent navigator. */
export function useRootStackNavigation(): NativeStackNavigationProp<RootStackParamList> {
  const nav = useNavigation();
  const parent = nav.getParent<NativeStackNavigationProp<RootStackParamList>>();
  if (parent) {
    return parent;
  }
  return nav as unknown as NativeStackNavigationProp<RootStackParamList>;
}
