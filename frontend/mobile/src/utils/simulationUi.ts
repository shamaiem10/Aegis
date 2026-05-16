import type { SimulatedActionApi } from "../api/types";
import type { IonName } from "./alertIcons";

export function formatActionTitle(actionId: string): string {
  return actionId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function actionIcon(actionId: string): IonName {
  const id = actionId.toLowerCase();
  if (id.includes("traffic") || id.includes("reroute")) return "swap-horizontal-outline";
  if (id.includes("ems") || id.includes("dispatch") || id.includes("medical")) return "medkit-outline";
  if (id.includes("public") || id.includes("alert")) return "megaphone-outline";
  if (id.includes("grid") || id.includes("power")) return "flash-outline";
  if (id.includes("utility") || id.includes("flood") || id.includes("water")) return "water-outline";
  if (id.includes("cooling") || id.includes("heat")) return "thermometer-outline";
  return "play-circle-outline";
}

export function totalTimeSavedMin(actions: SimulatedActionApi[]): number {
  return actions.reduce(
    (sum, a) => sum + (a.response_time_improvement_min ?? 0),
    0,
  );
}

export function totalResourceCost(actions: SimulatedActionApi[]): number {
  return actions.reduce((sum, a) => sum + (a.resource_cost_units ?? 0), 0);
}
