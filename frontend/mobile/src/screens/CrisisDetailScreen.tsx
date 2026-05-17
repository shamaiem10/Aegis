import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { CrisisDetailLayout } from "../components/aegis/CrisisDetailLayout";
import type { RootStackParamList } from "../navigation/types";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "CrisisDetail">;
  route: RouteProp<RootStackParamList, "CrisisDetail">;
};

/** Stack: single crisis dossier. */
export function CrisisDetailScreen({ navigation, route }: Props) {
  return <CrisisDetailLayout navigation={navigation} route={route} />;
}
