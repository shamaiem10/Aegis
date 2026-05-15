import type { SignalApi } from "../api/types";

/**
 * Backend feeds may reuse the same `id` for multiple rows (e.g. GDACS updates).
 * React lists and map markers need unique keys per rendered item.
 */
export function signalListKey(item: SignalApi, index: number): string {
  return `${item.id}\0${item.recorded_at}\0${index}`;
}
