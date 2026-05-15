import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const isCompact = width < 360;
    const isRegularPhone = width >= 360 && width < 428;
    const isLargePhone = width >= 428 && width < 768;
    const isTablet = width >= 768;

    const horizontalPad = Math.max(14, Math.min(26, Math.round(width * 0.048)));
    const gap = isCompact ? 8 : 10;
    const tabBarClearance = 88 + insets.bottom;
    const mapHeight = Math.round(
      Math.min(280, Math.max(168, Math.min(height * 0.32, width * 0.62))),
    );
    const kpiMinWidth = isCompact ? 100 : isTablet ? 120 : 108;
    const maxTileWidth = isTablet ? Math.min(420, (width - horizontalPad * 2 - gap * 2) / 3) : undefined;

    return {
      width,
      height,
      fontScale,
      insets,
      isCompact,
      isRegularPhone,
      isLargePhone,
      isTablet,
      horizontalPad,
      gap,
      tabBarClearance,
      mapHeight,
      kpiMinWidth,
      maxTileWidth,
      /** Scale body font slightly on small / large font accessibility settings */
      bodySize: (base: number) => Math.round(base * Math.min(1.12, Math.max(0.92, fontScale))),
      titleSize: (base: number) => Math.round(base * Math.min(1.08, Math.max(0.94, fontScale))),
    };
  }, [width, height, fontScale, insets]);
}
