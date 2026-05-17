import { callAntigravityAgent } from '../agentClient';
import type { FlatSignalInput } from './types';
import type {
  FalseAlarmAction,
  FalseAlarmCheckItem,
  FalseAlarmScreenResult,
} from './falseAlarmTypes';

const INSTRUCTION = `Role: FalseAlarmAgent — prevent bad public alerts (Pakistan EOC, Islamabad/Rawalpindi).
Screen each signal BEFORE dispatch. Look for single-source social rumors, contradictions, drill keywords, barbecue/smoke vs industrial fire, maintenance outages labeled as disasters.

Input: { signals: [{ id, text, source, kind, severity_hint, region }] }
Output: {
  "checks": [{
    "signalId": "",
    "recommendedAction": "CONFIRM"|"VERIFY_FIRST"|"RETRACT",
    "reason": "one line",
    "confidencePct": 0-100,
    "credibilityScore": 0-100,
    "corroborationCount": 0,
    "impactIfSent": "what happens if we alert without verification"
  }]
}
Rules:
- RETRACT: likely hoax, no corroboration, misinformation patterns.
- VERIFY_FIRST: plausible but single-source or conflicting sensors.
- CONFIRM: official (PMD, NDMA, Rescue 1122) or strong multi-source corroboration.
- One check per signal id. Be concise.`;

function compactSignals(signals: FlatSignalInput[]) {
  return signals.slice(0, 30).map((s) => ({
    id: s.id,
    text: String(s.text ?? '').slice(0, 160),
    source: s.source,
    kind: s.kind,
    severity_hint: s.severity_hint,
    region: s.region,
  }));
}

function credibilityFromSource(source: string): number {
  const src = source.toLowerCase();
  if (/ndma|pmd|official|rescue|1122|pepa|nhmp|government/.test(src)) return 96;
  if (/weather|open-meteo|usgs|gdacs/.test(src)) return 92;
  if (/traffic|here|waze/.test(src)) return 88;
  if (/social|twitter|facebook|telegram|whatsapp/.test(src)) return 32;
  return 55;
}

export function ruleBasedFalseAlarmChecks(signals: FlatSignalInput[]): FalseAlarmCheckItem[] {
  const byRegion = new Map<string, number>();
  for (const s of signals) {
    const r = String(s.region ?? 'unknown');
    byRegion.set(r, (byRegion.get(r) ?? 0) + 1);
  }

  return signals.slice(0, 30).map((s) => {
    const text = String(s.text ?? '').toLowerCase();
    const source = String(s.source ?? 'unknown');
    const cred = credibilityFromSource(source);
    const region = String(s.region ?? 'Pakistan');
    const corroboration = Math.max(0, (byRegion.get(region) ?? 1) - 1);
    const sev = Number(s.severity_hint) || 5;

    let recommendedAction: FalseAlarmAction = 'CONFIRM';
    let reason = 'Official or moderate-credibility feed — standard verification applies.';
    let impactIfSent = 'Normal EOC workflow; field verify if severity ≥ 7.';

    const dramatic =
      /fire|explosion|bomb|attack|shooting|collapse|hostage|gas leak|terror/.test(text);
    const softRumor = /barbecue|bbq|wedding|generator|maintenance|drill|test alert/.test(text);

    if (softRumor && cred < 70) {
      recommendedAction = 'RETRACT';
      reason = 'Language matches benign activity (maintenance/drill/BBQ) — do not mass-alert.';
      impactIfSent = 'Avoid unnecessary public panic (~thousands of needless notifications).';
    } else if (cred < 45 && dramatic) {
      recommendedAction = 'VERIFY_FIRST';
      reason = 'High-impact claim from low-credibility source — sensor/official corroboration required.';
      impactIfSent = 'Premature alert risks panic and resource diversion from real incidents.';
    } else if (cred < 35 && corroboration === 0) {
      recommendedAction = 'RETRACT';
      reason = 'Single low-credibility source with no regional corroboration.';
      impactIfSent = 'False public alert would erode trust and waste dispatch capacity.';
    } else if (cred >= 90) {
      recommendedAction = 'CONFIRM';
      reason = 'Official feed — proceed with standard EOC verification.';
      impactIfSent = 'Timely official alerting appropriate after duty-officer sign-off.';
    } else if (sev >= 8 && cred < 60) {
      recommendedAction = 'VERIFY_FIRST';
      reason = `Severity ${sev}/10 but source trust ${cred}% — verify before escalate.`;
      impactIfSent = 'Could over-escalate queue ahead of verified life-safety incidents.';
    }

    return {
      signalId: s.id,
      crisisId: s.id.startsWith('pk-') ? s.id : `pk-${s.id}`,
      title: String(s.text ?? s.kind ?? 'Alert').slice(0, 100),
      recommendedAction,
      reason,
      confidencePct: Math.min(95, Math.round(cred * 0.6 + (recommendedAction === 'CONFIRM' ? 25 : 15))),
      credibilityScore: cred,
      corroborationCount: corroboration,
      impactIfSent,
      operatorStatus: 'pending' as const,
      source,
      region,
    };
  });
}

function parseChecks(raw: unknown, signals: FlatSignalInput[]): FalseAlarmCheckItem[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { checks?: unknown })?.checks)
      ? (raw as { checks: unknown[] }).checks
      : Array.isArray((raw as { falseAlarmChecks?: unknown })?.falseAlarmChecks)
        ? (raw as { falseAlarmChecks: unknown[] }).falseAlarmChecks
        : [];

  if (list.length === 0) return ruleBasedFalseAlarmChecks(signals);

  const byId = new Map(signals.map((s) => [s.id, s]));
  return list
    .map((row) => {
      const r = row as Record<string, unknown>;
      const signalId = String(r.signalId ?? r.signal_id ?? '');
      const sig = byId.get(signalId);
      const action = String(r.recommendedAction ?? r.recommendation ?? 'VERIFY_FIRST').toUpperCase();
      const recommendedAction = (
        action === 'RETRACT' || action === 'CONFIRM' || action === 'VERIFY_FIRST'
          ? action
          : 'VERIFY_FIRST'
      ) as FalseAlarmAction;

      return {
        signalId,
        crisisId: String(r.crisisId ?? r.crisis_id ?? (sig ? `pk-${sig.id}` : '')),
        title: String(r.title ?? sig?.text?.slice(0, 100) ?? 'Alert'),
        recommendedAction,
        reason: String(r.reason ?? r.rationale ?? ''),
        confidencePct: Number(r.confidencePct ?? r.confidence ?? 70),
        credibilityScore: Number(r.credibilityScore ?? credibilityFromSource(String(sig?.source ?? ''))),
        corroborationCount: Number(r.corroborationCount ?? 0),
        impactIfSent: String(r.impactIfSent ?? r.impact ?? 'Review before public alert.'),
        operatorStatus: 'pending' as const,
        source: String(sig?.source ?? ''),
        region: String(sig?.region ?? ''),
      };
    })
    .filter((c) => c.signalId);
}

export function buildFalseAlarmScreenResult(
  checks: FalseAlarmCheckItem[],
  degraded: string[],
): FalseAlarmScreenResult {
  const queue = checks.filter(
    (c) =>
      c.operatorStatus === 'pending' &&
      (c.recommendedAction === 'RETRACT' || c.recommendedAction === 'VERIFY_FIRST'),
  );
  return {
    checks,
    queue,
    screenedCount: checks.length,
    falseAlarmCount: checks.filter((c) => c.recommendedAction === 'RETRACT').length,
    verifyCount: checks.filter((c) => c.recommendedAction === 'VERIFY_FIRST').length,
    degradedMode: degraded.length > 0,
    degradedAgents: [...new Set(degraded)],
    generatedAt: new Date().toISOString(),
    agentName: 'FalseAlarmAgent',
  };
}

export async function runFalseAlarmScreenAgent(
  signals: FlatSignalInput[],
  degraded: string[] = [],
): Promise<FalseAlarmScreenResult> {
  if (signals.length === 0) {
    return buildFalseAlarmScreenResult([], degraded);
  }

  try {
    const parsed = await callAntigravityAgent(
      'FalseAlarmAgent',
      INSTRUCTION,
      { signals: compactSignals(signals) },
      degraded,
    );
    const checks = parseChecks(parsed.checks ?? parsed.falseAlarmChecks ?? parsed, signals);
    return buildFalseAlarmScreenResult(checks, degraded);
  } catch {
    return buildFalseAlarmScreenResult(ruleBasedFalseAlarmChecks(signals), ['FalseAlarmAgent']);
  }
}
