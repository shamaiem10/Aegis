/**
 * Barrel export — mirror of web `@/components/aegis` public surface used on mobile.
 */
export {
  PageHeader,
  Card,
  Pill,
  SeverityBar,
  MiniBar,
  CiroBrandHeader,
  SystemNominalCard,
  SectionCaps,
  DashboardGreeting,
  MapCardChrome,
  KpiTile,
  AlertPreviewRow,
  SourcePill,
  ConfidenceBar,
  ActionFooter,
  GradientHeroCard,
  ReasoningBullet,
  type PillTone,
  type AlertPriority,
} from "./AppShell";
export type { CrisisType, Crisis, SignalSource, Signal, Resource } from "./data";
export { crises, signals, resources, apiHealth, agentTrace } from "./data";
