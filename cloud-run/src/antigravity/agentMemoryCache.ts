import type { AgentArtifactBundle } from './agents/types';

const mem = new Map<string, { bundle: AgentArtifactBundle; at: number }>();
const TTL_MS = 20 * 60 * 1000;

export function memoryGet(artifactId: string): AgentArtifactBundle | null {
  const row = mem.get(artifactId);
  if (!row) return null;
  if (Date.now() - row.at > TTL_MS) {
    mem.delete(artifactId);
    return null;
  }
  return row.bundle;
}

export function memorySet(artifactId: string, bundle: AgentArtifactBundle): void {
  mem.set(artifactId, { bundle, at: Date.now() });
}
