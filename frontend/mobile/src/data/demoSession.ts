import type { CrisisDossierApi, CrisisStatusApi } from "../api/types";

import { DEMO_ORCHESTRATION_META } from "./demoOrchestrationMeta";

import { DEMO_ISLAMABAD_DOSSIERS } from "./demoIslamabadCrises";

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

/** In-memory dossiers while demo mode is active (lost on cold start unless re-seeded). */
let dossiers: CrisisDossierApi[] = [];

export function demoSessionReset(): void {
  dossiers = DEMO_ISLAMABAD_DOSSIERS.map((d) => {
    const row = clone(d);
    row.meta = {
      ...clone(DEMO_ORCHESTRATION_META),
      ...(row.meta ?? {}),
    };
    return row;
  });
}

function ensure(): CrisisDossierApi[] {
  if (dossiers.length === 0) demoSessionReset();
  return dossiers;
}

export function demoListCrises(filter?: {
  limit?: number;
  status?: string;
}): CrisisDossierApi[] {
  let rows = [...ensure()];
  if (filter?.status) {
    rows = rows.filter((r) => r.status === filter.status);
  }
  rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  if (filter?.limit != null && filter.limit > 0) {
    rows = rows.slice(0, filter.limit);
  }
  return rows;
}

export function demoGetCrisis(id: string): CrisisDossierApi | undefined {
  return ensure().find((d) => d.crisis_id === id);
}

export function demoPatchStatus(
  id: string,
  status: CrisisStatusApi,
): CrisisDossierApi {
  ensure();
  const i = dossiers.findIndex((d) => d.crisis_id === id);
  if (i < 0) {
    throw new Error(`demo: crisis not found (${id})`);
  }
  const next = clone(dossiers[i]);
  next.status = status;
  dossiers[i] = next;
  return next;
}

export function demoRunPipeline(): CrisisDossierApi {
  ensure();
  const template = dossiers[0] ?? DEMO_ISLAMABAD_DOSSIERS[0];
  const sim = clone(template);
  const ts = Date.now();
  sim.crisis_id = `demo_sim_${ts}`;
  sim.status = "active";
  sim.created_at = new Date().toISOString();
  sim.classification.rationale +=
    " [Simulated run — connect a real backend in Settings for live fusion.]";
  sim.meta = {
    ...(sim.meta ?? {}),
    ...DEMO_ORCHESTRATION_META,
    demo_simulated: true,
    simulated_at: sim.created_at,
  };
  sim.notifications = [
    {
      channel: "ops_console",
      title: "Demo pipeline",
      body: `${sim.crisis_id} — local simulation; server keys not required`,
    },
  ];
  dossiers.unshift(sim);
  return sim;
}

/** Offline twin of `/api/v1/pipeline/run/scenario` meta shape (for Agents / Sim tabs). */
export function demoRunScenario(): CrisisDossierApi {
  const d = demoRunPipeline();
  d.meta = {
    ...(d.meta ?? {}),
    demo_scenario: "g10_flood_plus_heat",
    scenario_note: "Mock dual-incident narrative; connect backend for full trace fidelity.",
  };
  return d;
}
