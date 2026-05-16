import type {
  ActionPlanResult,
  ActionPlanPhase,
  AgentPriority,
  AlertTriageResult,
  CrisisAnalysisResult,
  FlatSignalInput,
} from './types';

function categoryFromSignal(s: FlatSignalInput): string {
  const mock = (s.payload?.mock_category as string) || '';
  if (mock) return mock;
  const kind = (s.kind || '').toLowerCase();
  if (/flood|hydro|rain/.test(kind)) return 'floods';
  if (/quake|seismic/.test(kind)) return 'earthquakes';
  if (/health|disease|measles|dengue/.test(kind)) return 'disease';
  if (/traffic|accident|road/.test(kind)) return 'accidents';
  return 'general';
}

function priorityFromSeverity(sev: number): AgentPriority {
  if (sev >= 8) return 'CRITICAL';
  if (sev >= 6) return 'HIGH';
  if (sev >= 4) return 'MEDIUM';
  return 'LOW';
}

function signalFromPayload(payload: { input?: unknown; instruction?: string }): FlatSignalInput {
  const input = (payload.input ?? payload) as Record<string, unknown>;
  const signal = (input.signal ?? input) as FlatSignalInput;
  return signal?.id ? signal : { id: 'unknown', text: '', severity_hint: 5, region: 'Pakistan' };
}

function ruleBasedActionPlan(signal: FlatSignalInput, crisisId: string): ActionPlanResult {
  const sev = Number(signal.severity_hint) || 5;
  const cat = categoryFromSignal(signal);
  const region = signal.region || 'target area';

  const phases: ActionPlanPhase[] = [
    {
      name: `Field verification in ${region}`,
      actions: ['Deploy field verification team', 'Confirm incident geometry and severity'],
      owner: 'District EOC',
      etaMin: 15,
    },
    {
      name: 'Traffic staging',
      actions: ['Stage traffic cordon', 'Setup alternate routes'],
      owner: 'NHMP / Traffic cell',
      etaMin: cat === 'accidents' ? 8 : 20,
    },
    {
      name: 'EMS dispatch',
      actions: ['Pre-position EMS and rescue assets'],
      owner: 'Rescue 1122 / EMS',
      etaMin: 12,
    },
    {
      name: 'Public communications',
      actions: ['Issue tiered public advisory (Urdu + English)'],
      owner: 'NDMA / PDMA liaison',
      etaMin: 30,
    },
  ];

  if (cat === 'floods') {
    phases.push({
      name: 'Hydrology assessment',
      actions: ['Pull upstream gauge + dam release telemetry'],
      owner: 'Irrigation / PDMA',
      etaMin: 10,
    });
  }

  if (cat === 'earthquakes') {
    phases.push({
      name: 'Structural scanning',
      actions: ['Rapid structural assessment of critical facilities'],
      owner: 'PDMA engineering',
      etaMin: 30,
    });
  }

  if (cat === 'disease') {
    phases.push({
      name: 'Health surveillance',
      actions: ['Activate case-finding in 5 km surveillance ring'],
      owner: 'DHIS / District health',
      etaMin: 45,
    });
  }

  return {
    crisisId,
    signalId: signal.id,
    phases: phases.slice(0, 6),
    resourceNeeds: ['Ambulances', 'Police units'],
    risks: ['Secondary collisions', 'Public panic'],
    degradedMode: true,
    generatedAt: new Date().toISOString(),
    agentName: 'ActionPlanAgent',
  };
}

function ruleBasedTriage(signal: FlatSignalInput): AlertTriageResult {
  const sev = Number(signal.severity_hint) || 5;
  const pri = priorityFromSeverity(sev);
  const region = signal.region || 'Pakistan';
  const text = (signal.text || '').slice(0, 120);

  return {
    signalId: signal.id,
    disposition: sev >= 7 ? 'escalate' : sev >= 4 ? 'monitor' : 'dismiss_candidate',
    priority: pri,
    confidencePct: Math.min(95, 55 + sev * 4),
    headline: text.length > 72 ? `${text.slice(0, 69)}…` : text || 'Unnamed alert',
    rationale: `Severity hint ${sev}/10 from ${signal.source || 'feed'}; region ${region}.`,
    recommendedNextSteps: [
      'Open crisis dossier and confirm fused signals.',
      'Run coordinated action plan.',
      sev >= 8 ? 'Notify district EOC within 15 minutes.' : 'Schedule next fusion pass in 30 minutes.',
    ],
    assignTo: sev >= 8 ? ['District EOC', 'EMS dispatch', 'Comms cell'] : ['Monitoring desk'],
    degradedMode: true,
    generatedAt: new Date().toISOString(),
    agentName: 'AlertTriageAgent',
  };
}

function ruleBasedCrisisAnalysis(signal: FlatSignalInput, crisisId: string): CrisisAnalysisResult {
  const sev = Number(signal.severity_hint) || 5;
  const cat = categoryFromSignal(signal);
  const region = signal.region || 'Pakistan';

  return {
    crisisId,
    signalId: signal.id,
    hypothesis: `${cat.replace(/_/g, ' ')} incident in ${region} rated ${sev}/10. Coordinate field verification, resource staging, and tiered public messaging.`,
    evidence: [
      'Secondary casualties if traffic not cordoned',
      'Misinformation amplification on social channels',
      sev >= 8 ? 'Hospital surge without pre-alert' : 'Under-reaction if left in monitoring-only mode',
    ],
    gaps: [cat, 'transport', 'public safety', sev >= 7 ? 'healthcare' : 'logistics'].filter(
      Boolean,
    ) as string[],
    recommendedActions: [
      'Single incident commander at district EOC.',
      'Stagger public advisories 8–12 minutes apart.',
      'Log all agent outputs to audit trail before dispatch.',
    ],
    stakeholderAlerts: [
      {
        audience: 'District EOC',
        message: `Active ${cat} case — severity ${sev}. Stand up coordination cell.`,
        urgency: priorityFromSeverity(sev),
      },
      {
        audience: 'Public (staged)',
        message: `Developing situation in ${region}. Follow official channels only.`,
        urgency: sev >= 8 ? 'HIGH' : 'MEDIUM',
      },
    ],
    degradedMode: true,
    generatedAt: new Date().toISOString(),
    agentName: 'CrisisAnalysisAgent',
  };
}

/** Rule-based outputs when Vertex/Gemini is unavailable. */
export function runRuleBasedFallback(
  agentName: string,
  payload: { input?: unknown; instruction?: string },
): Record<string, unknown> {
  if (agentName === 'SignalFusionAgent') {
    const input = payload.input as { signals?: unknown[] } | undefined;
    const signals = input?.signals || [];
    const fusedSignals = (signals as Record<string, unknown>[]).map((s) => {
      let credibilityScore = 50;
      const src = String(s.sourceType || s.source || '').toLowerCase();
      if (src === 'official' || src === 'pmd' || src === 'ndma') credibilityScore = 99;
      else if (src === 'weather' || src === 'open-meteo') credibilityScore = 94;
      else if (src === 'traffic' || src === 'here') credibilityScore = 91;
      return {
        ...s,
        credibilityScore,
        urgencyScore: 50,
        corroborationCount: 0,
        contradictionFlag: false,
        misinformationFlag: false,
      };
    });
    return { fusedSignals };
  }

  if (agentName === 'CrisisClassificationAgent') {
    return {
      incidents: [
        {
          crisisType: 'Unknown',
          severity: 'Medium',
          confidence: 40,
          status: 'UNVERIFIED',
          location: { lat: 33.6844, lng: 73.0479, label: 'Islamabad/Rawalpindi', affectedSectors: [] },
          affectedPopulation: 0,
          vulnerableCount: 0,
          conflictingHypotheses: [],
          detectedAt: new Date().toISOString(),
        },
      ],
    };
  }

  if (agentName === 'SeverityPredictionAgent') {
    return { predictions: [], note: 'rule-based fallback active' };
  }
  if (agentName === 'ResourceAllocationAgent') {
    return { allocations: [], shortages: [], tradeoffs: [], note: 'rule-based fallback active' };
  }
  if (agentName === 'FalseAlarmAgent') {
    return { falseAlarmChecks: [], note: 'rule-based fallback active' };
  }
  if (agentName === 'CompoundRiskAgent') {
    return { compoundRisks: [], note: 'rule-based fallback active' };
  }
  if (agentName === 'StakeholderAlertAgent') {
    return { alertDrafts: [], note: 'rule-based fallback active' };
  }

  if (agentName === 'CombinedOrchestrationAgent') {
    const classOut = runRuleBasedFallback('CrisisClassificationAgent', payload) as {
      incidents?: unknown[];
    };
    const sev = runRuleBasedFallback('SeverityPredictionAgent', payload);
    const alloc = runRuleBasedFallback('ResourceAllocationAgent', payload);
    const fa = runRuleBasedFallback('FalseAlarmAgent', payload);
    const compound = runRuleBasedFallback('CompoundRiskAgent', payload);
    const alerts = runRuleBasedFallback('StakeholderAlertAgent', payload);
    return {
      incidents: classOut.incidents ?? [],
      predictions: (sev as { predictions?: unknown[] }).predictions ?? [],
      allocations: (alloc as { allocations?: unknown[] }).allocations ?? [],
      falseAlarmChecks: (fa as { falseAlarmChecks?: unknown[] }).falseAlarmChecks ?? [],
      compoundRisks: (compound as { compoundRisks?: unknown[] }).compoundRisks ?? [],
      alertDrafts: (alerts as { alertDrafts?: unknown[] }).alertDrafts ?? [],
      note: 'rule-based combined fallback',
    };
  }

  const signal = signalFromPayload(payload);
  const crisisId =
    (payload.input as { crisisId?: string })?.crisisId ||
    (payload.input as { crisis?: { crisis_id?: string } })?.crisis?.crisis_id ||
    `pk-${signal.id}`;

  if (agentName === 'AlertTriageAgent') {
    return { triage: ruleBasedTriage(signal) };
  }
  if (agentName === 'CrisisAnalysisAgent') {
    return { analysis: ruleBasedCrisisAnalysis(signal, crisisId) };
  }
  if (agentName === 'ActionPlanAgent') {
    return { actionPlan: ruleBasedActionPlan(signal, crisisId) };
  }

  return { note: 'rule-based fallback active' };
}
