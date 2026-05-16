import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { SimulationLivePanel } from "../components/aegis/SimulationLivePanel";
import type { RootStackParamList } from "../navigation/types";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "SimulationLive">;
  route: RouteProp<RootStackParamList, "SimulationLive">;
};

export function SimulationLiveScreen({ route }: Props) {
  return <SimulationLivePanel initialActionId={route.params?.initialActionId} />;
}
