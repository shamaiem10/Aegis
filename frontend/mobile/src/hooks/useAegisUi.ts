import { useMemo } from "react";

import { useResponsiveLayout } from "./useResponsiveLayout";
import { useThemeCiro } from "../theme/useThemeCiro";

/**
 * Central place for theme + breakpoints. Use on screens for consistent padding,
 * max readable width on tablets, and touch-friendly sizing.
 */
export function useAegisUi() {
  const tc = useThemeCiro();
  const r = useResponsiveLayout();

  return useMemo(() => {
    /** Readable column width on large phones / tablets (centered content). */
    const contentMaxWidth = r.isTablet
      ? Math.min(720, r.width - r.horizontalPad * 2)
      : r.isLargePhone
        ? Math.min(560, r.width - r.horizontalPad * 2)
        : undefined;

    const cardPadding = r.isCompact ? 16 : r.isTablet ? 22 : 20;
    const cardRadius = r.isCompact ? 22 : 26;
    const sectionGap = r.isCompact ? 14 : 18;
    /** iOS HIG / Material minimum touch target */
    const minTouch = 44;

    return {
      tc,
      r,
      contentMaxWidth,
      cardPadding,
      cardRadius,
      sectionGap,
      minTouch,
      /** Wrap scroll/list inner content: centers on wide screens */
      contentWrap: {
        width: "100%" as const,
        maxWidth: contentMaxWidth ?? ("100%" as const),
        alignSelf: "center" as const,
      },
    };
  }, [tc, r]);
}
