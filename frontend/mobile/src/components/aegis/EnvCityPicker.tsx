import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import {
  PAKISTAN_ENV_CITY_OPTIONS,
  type PakistanEnvCityKey,
} from "../../api/pakistanEnvLive";
import { useThemeCiro } from "../../theme/useThemeCiro";

export function EnvCityPicker({
  selected,
  onSelect,
  disabled,
}: {
  selected: PakistanEnvCityKey;
  onSelect: (key: PakistanEnvCityKey) => void;
  disabled?: boolean;
}) {
  const tc = useThemeCiro();
  const styles = createStyles(tc);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.wrap}
    >
      {PAKISTAN_ENV_CITY_OPTIONS.map((opt) => {
        const on = selected === opt.key;
        return (
          <Pressable
            key={opt.key}
            disabled={disabled}
            onPress={() => onSelect(opt.key)}
            style={[
              styles.chip,
              {
                backgroundColor: on ? tc.tealSoft : tc.muted,
                borderColor: on ? tc.tealDeep : tc.border,
                opacity: disabled ? 0.55 : 1,
              },
            ]}
          >
            <Text style={[styles.chipTxt, on && { color: tc.tealDeep }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: { marginTop: 10, marginBottom: 4 },
    row: { gap: 8, paddingVertical: 2 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    chipTxt: { fontSize: 11, fontWeight: "800", color: tc.ink },
  });
}
