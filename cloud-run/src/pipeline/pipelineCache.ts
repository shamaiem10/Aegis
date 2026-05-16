import type { CrisisDossierOut } from "./buildDossiers";

const TTL_MS = 3 * 60 * 1000;

type Entry = { at: number; dossiers: CrisisDossierOut[]; degraded: string[] };

const store = new Map<string, Entry>();

function key(scenarioId: string | undefined, fast: boolean): string {
  return `${fast ? "fast" : "full"}:${scenarioId ?? "live"}`;
}

export function getCachedPipeline(
  scenarioId: string | undefined,
  fast: boolean,
): Entry | null {
  const e = store.get(key(scenarioId, fast));
  if (!e) return null;
  if (Date.now() - e.at > TTL_MS) {
    store.delete(key(scenarioId, fast));
    return null;
  }
  return e;
}

export function setCachedPipeline(
  scenarioId: string | undefined,
  fast: boolean,
  dossiers: CrisisDossierOut[],
  degraded: string[],
): void {
  store.set(key(scenarioId, fast), { at: Date.now(), dossiers, degraded });
}
