import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { CrisesDeskLayout } from "../components/aegis/CrisesDeskLayout";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList, "Crises">;

/** Stack: live crisis dossiers from Firestore. */
export function CrisesScreen({ navigation }: { navigation: Nav }) {
  return <CrisesDeskLayout navigation={navigation} />;
}
