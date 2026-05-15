import { useColorScheme } from "react-native";

import { ciro } from "./ciro";

/** Dark surfaces aligned with orchestration palette; use on every screen via hook. */
export const ciroDark = ({
  ...ciro,
  canvas: "#050810",
  canvasMuted: "#0a1019",
  background: "#050810",
  card: "#0c121f",
  cardTint: "#111827",
  ink: "#e2e8f0",
  inkSoft: "#94a3b8",
  inkMuted: "#64748b",
  border: "#1e293b",
  borderSoft: "#1e293b",
  muted: "#0f1729",
  sky: "#1e3a5f",
  sage: "#064e3b",
  warnSurface: "#422006",
  heroGradStart: "#0f1729",
  heroGradEnd: "#0c121f",
} as unknown) as typeof ciro;

export function useThemeCiro(): typeof ciro {
  return useColorScheme() === "dark" ? ciroDark : ciro;
}
