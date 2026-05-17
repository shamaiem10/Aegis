import { fetchRemoteResourceInventory } from '../../apis/resourceInventoryClient';
import { agentLlmProviders, generateGeminiJson } from '../geminiGenerate';
import type { FlatSignalInput } from './types';

export type SeverityDimension = {
  value: number;
  sub: string;
  recommendation: string;
};

export type AiSeverityIndexResult = {
  heat: SeverityDimension;
  air: SeverityDimension;
  flood: SeverityDimension;
  overallRiskScore: number;
  countrySummary: string;
  recommendations: string[];
  degradedMode: boolean;
  generatedAt: string;
  agentName: string;
};

const INSTRUCTION = `You are AEGIS Pakistan national severity index advisor.
Given live environmental readings, active alerts, crises, and emergency resource availability, produce a unified severity assessment.

Return JSON only:
{
  "heat": { "value": 0-100, "sub": "one line status", "recommendation": "actionable 1-2 sentences" },
  "air": { "value": 0-100, "sub": "...", "recommendation": "..." },
  "flood": { "value": 0-100, "sub": "...", "recommendation": "..." },
  "overallRiskScore": 0-100,
  "countrySummary": "2-3 sentences on Pakistan-wide crisis posture",
  "recommendations": ["3-5 operator bullets prioritizing resources and messaging"]
}

Rules:
- value should reflect combined env metrics + alert/crisis severity (not ignore active floods/AQI).
- recommendations must mention resource trade-offs when capacity is tight.
- Pakistan context: NDMA, monsoon, urban AQI, heatwaves.`;

function compactSignals(signals: FlatSignalInput[]) {
  return signals.slice(0, 25).map((s) => ({
    id: s.id,
    kind: s.kind,
    text: String(s.text ?? '').slice(0, 100),
    severity_hint: s.severity_hint,
    region: s.region,
  }));
}

function compactCrises(crises: Record<string, unknown>[]) {
  return crises.slice(0, 15).map((c) => ({
    crisis_id: c.crisis_id,
    status: c.status,
    category: (c.classification as { category?: string })?.category,
    severity: (c.severity as { score?: number })?.score,
    region: (c.fused as { region?: string }[])?.[0]?.region,
  }));
}

function ruleBasedFallback(
  env: Record<string, unknown>,
  alertCount: number,
  crisisCount: number,
): AiSeverityIndexResult {
  const heatV = Number((env.heat as { value?: number })?.value ?? 0);
  const airV = Number((env.air as { value?: number })?.value ?? 0);
  const floodV = Number((env.flood as { value?: number })?.value ?? 0);
  const overall = Math.min(100, Math.round((heatV + airV + floodV) / 3 + alertCount * 2));
  return {
    heat: {
      value: heatV,
      sub: String((env.heat as { sub?: string })?.sub ?? 'Heat stress from feeds'),
      recommendation: 'Pre-position cooling stations if heat index remains elevated.',
    },
    air: {
      value: airV,
      sub: String((env.air as { sub?: string })?.sub ?? 'Air quality from feeds'),
      recommendation: 'Issue AQI-sensitive advisories for vulnerable groups.',
    },
    flood: {
      value: floodV,
      sub: String((env.flood as { sub?: string })?.sub ?? 'Flood risk from feeds'),
      recommendation: 'Monitor hydrology and pre-stage rescue assets in flood corridors.',
    },
    overallRiskScore: overall,
    countrySummary: `${alertCount} alerts and ${crisisCount} dossiers active. Rule-based severity index (connect Groq for AI narrative).`,
    recommendations: [
      'Run contextual enrich on top-priority alerts.',
      'Sync resource inventory before pipeline allocation.',
    ],
    degradedMode: true,
    generatedAt: new Date().toISOString(),
    agentName: 'SeverityIndexAgent',
  };
}

export async function runSeverityIndexAgent(input: {
  envIndex: Record<string, unknown>;
  signals: FlatSignalInput[];
  crises: Record<string, unknown>[];
  selectedCity?: string;
}): Promise<AiSeverityIndexResult> {
  let resources: { resource_id: string; name: string; quantity_available: number; kind: string }[] = [];
  try {
    const inv = await fetchRemoteResourceInventory(false);
    resources = (inv.units ?? []).slice(0, 30).map((u) => ({
      resource_id: u.resource_id,
      name: u.name,
      quantity_available: u.quantity_available,
      kind: u.kind,
    }));
  } catch {
    /* optional */
  }

  try {
    const parsed = await generateGeminiJson(
      {
        instruction: INSTRUCTION,
        input: {
          selectedCity: input.selectedCity ?? 'all',
          environmental: input.envIndex,
          alerts: compactSignals(input.signals),
          crises: compactCrises(input.crises),
          resources,
          alertCount: input.signals.length,
          crisisCount: input.crises.length,
        },
      },
      { providers: agentLlmProviders() },
    );

    const clamp = (n: unknown, fallback: number) => {
      const v = Number(n);
      return Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : fallback;
    };

    const dim = (key: string, fallback: number): SeverityDimension => {
      const d = (parsed[key] as Record<string, unknown>) ?? {};
      const envDim = (input.envIndex[key] as { value?: number; sub?: string }) ?? {};
      return {
        value: clamp(d.value, fallback),
        sub: String(d.sub ?? envDim.sub ?? ''),
        recommendation: String(d.recommendation ?? 'Monitor and re-assess in 30 minutes.'),
      };
    };

    return {
      heat: dim('heat', Number((input.envIndex.heat as { value?: number })?.value ?? 0)),
      air: dim('air', Number((input.envIndex.air as { value?: number })?.value ?? 0)),
      flood: dim('flood', Number((input.envIndex.flood as { value?: number })?.value ?? 0)),
      overallRiskScore: clamp(parsed.overallRiskScore, 50),
      countrySummary: String(parsed.countrySummary ?? 'Pakistan operational watch.'),
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map(String).slice(0, 6)
        : [],
      degradedMode: false,
      generatedAt: new Date().toISOString(),
      agentName: 'SeverityIndexAgent',
    };
  } catch (e) {
    console.warn('[SeverityIndexAgent] fallback:', (e as Error).message);
    return ruleBasedFallback(input.envIndex, input.signals.length, input.crises.length);
  }
}
