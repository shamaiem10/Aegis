import type { AgentPriority, ActionPlanResult, AlertTriageResult, FlatSignalInput } from './agents/types';
import type {
  MobileActionPlanResult,
  MobileActionPlanTask,
  MobileCrisisAnalysisResult,
} from './agents/contextualTypes';

const now = () => new Date().toISOString();

export function normalizeAnalysisForMobile(
  raw: Record<string, unknown>,
  crisisId: string,
  signalId: string,
  agentName: string,
  degradedMode: boolean,
): MobileCrisisAnalysisResult {
  const executiveSummary = String(
    raw.executiveSummary ?? raw.hypothesis ?? 'Analysis pending field verification.',
  );
  const keyRisks = Array.isArray(raw.keyRisks)
    ? raw.keyRisks.map(String)
    : Array.isArray(raw.evidence)
      ? raw.evidence.map(String)
      : [];
  const affectedDomains = Array.isArray(raw.affectedDomains)
    ? raw.affectedDomains.map(String)
    : Array.isArray(raw.gaps)
      ? raw.gaps.map(String)
      : [];
  const coordinationNotes = Array.isArray(raw.coordinationNotes)
    ? raw.coordinationNotes.map(String)
    : Array.isArray(raw.recommendedActions)
      ? raw.recommendedActions.map(String)
      : [];

  return {
    crisisId: String(raw.crisisId ?? crisisId),
    signalId,
    executiveSummary,
    keyRisks: keyRisks.slice(0, 6),
    affectedDomains: affectedDomains.slice(0, 6),
    coordinationNotes: coordinationNotes.slice(0, 6),
    stakeholderAlerts: Array.isArray(raw.stakeholderAlerts)
      ? (raw.stakeholderAlerts as { audience?: string; message?: string; urgency?: string }[]).map(
          (a) => ({
            audience: String(a.audience ?? 'EOC'),
            message: String(a.message ?? ''),
            urgency: (a.urgency as AgentPriority) ?? 'HIGH',
          }),
        )
      : [],
    degradedMode,
    generatedAt: now(),
    agentName,
  };
}

export function normalizeActionPlanForMobile(
  raw: Record<string, unknown>,
  crisisId: string,
  signalId: string,
  defaultPriority: AgentPriority,
  agentName: string,
  degradedMode: boolean,
): MobileActionPlanResult {
  if (Array.isArray(raw.tasks) && raw.tasks.length) {
    const tasks = (raw.tasks as MobileActionPlanTask[]).map((t, i) => ({
      taskId: String(t.taskId ?? `task-${i}`),
      title: String(t.title ?? 'Action'),
      priority: (t.priority as AgentPriority) ?? defaultPriority,
      etaMinutes: t.etaMinutes ?? null,
      etaLabel: String(t.etaLabel ?? (t.etaMinutes != null ? `${t.etaMinutes} min` : 'ASAP')),
      impactScore: Number(t.impactScore ?? 60),
      owner: String(t.owner ?? 'District EOC'),
      category: String(t.category ?? 'operations'),
      rationale: String(t.rationale ?? ''),
      iconHint: t.iconHint,
      assignedResourceId: t.assignedResourceId,
    }));
    const totalEtaMinutes = tasks.reduce((s, t) => s + (t.etaMinutes ?? 0), 0);
    return {
      crisisId: String(raw.crisisId ?? crisisId),
      signalId,
      summary: String(raw.summary ?? 'Coordinated response plan'),
      totalEtaMinutes,
      tasks,
      resourceNeeds: Array.isArray(raw.resourceNeeds) ? raw.resourceNeeds.map(String) : undefined,
      risks: Array.isArray(raw.risks) ? raw.risks.map(String) : undefined,
      degradedMode,
      generatedAt: now(),
      agentName,
    };
  }

  const phases = Array.isArray(raw.phases) ? raw.phases : [];
  const tasks: MobileActionPlanTask[] = [];
  for (const phase of phases as Record<string, unknown>[]) {
    const actions = Array.isArray(phase.actions) ? phase.actions : [phase.actions];
    const owner = String(phase.owner ?? 'District EOC');
    const etaMin = Number(phase.etaMin ?? 15);
    const name = String(phase.name ?? 'phase');
    actions.forEach((action, ai) => {
      if (action == null) return;
      tasks.push({
        taskId: `${name}-${ai}`,
        title: String(action),
        priority: defaultPriority,
        etaMinutes: etaMin,
        etaLabel: `${etaMin} min`,
        impactScore: Math.min(95, 50 + defaultPriority.length * 5),
        owner,
        category: name,
        rationale: `Phase: ${name}`,
        iconHint: 'flash-outline',
        assignedResourceId:
          typeof phase.assignedResourceUnitId === 'string'
            ? phase.assignedResourceUnitId
            : undefined,
      });
    });
  }

  const totalEtaMinutes = tasks.reduce((s, t) => s + (t.etaMinutes ?? 0), 0);
  return {
    crisisId: String(raw.crisisId ?? crisisId),
    signalId,
    summary: String(raw.summary ?? 'Multi-phase operational plan'),
    totalEtaMinutes,
    tasks: tasks.slice(0, 8),
    resourceNeeds: Array.isArray(raw.resourceNeeds) ? raw.resourceNeeds.map(String) : undefined,
    risks: Array.isArray(raw.risks) ? raw.risks.map(String) : undefined,
    degradedMode,
    generatedAt: now(),
    agentName,
  };
}

export function priorityFromSeverity(sev: number): AgentPriority {
  if (sev >= 8.5) return 'CRITICAL';
  if (sev >= 7) return 'HIGH';
  if (sev >= 4.5) return 'MEDIUM';
  return 'LOW';
}

export function ruleBasedContextualPlan(
  focus: FlatSignalInput,
  allSignals: FlatSignalInput[],
  crisisId: string,
): import('./agents/contextualTypes').ContextualAlertPlanResult {
  const ranked = [...allSignals]
    .map((s) => ({
      signalId: s.id,
      headline: (s.text || s.kind || 'Alert').slice(0, 80),
      sev: Number(s.severity_hint) || 5,
    }))
    .sort((a, b) => b.sev - a.sev)
    .map((r, i) => ({
      signalId: r.signalId,
      headline: r.headline,
      priority: priorityFromSeverity(r.sev),
      rank: i + 1,
      score: Math.round(r.sev * 10),
      rationale: `Severity ${r.sev}/10 · queue position ${i + 1}`,
    }));

  const focusRow = ranked.find((r) => r.signalId === focus.id) ?? ranked[0];
  const pri = focusRow?.priority ?? priorityFromSeverity(Number(focus.severity_hint) || 5);

  const triage: AlertTriageResult = {
    signalId: focus.id,
    disposition: pri === 'LOW' ? 'monitor' : 'escalate',
    priority: pri,
    confidencePct: 62,
    headline: (focus.text || 'Incident').slice(0, 72),
    rationale: `Rule-based queue: rank ${focusRow?.rank ?? 1} of ${ranked.length} active alerts.`,
    recommendedNextSteps: [
      'Confirm incident with field teams.',
      'Stage resources per assignments below.',
      'Defer lower-priority alerts if capacity constrained.',
    ],
    assignTo: ['District EOC', 'Rescue 1122'],
    degradedMode: true,
    generatedAt: now(),
    agentName: 'ContextualAlertOrchestrator',
  };

  const analysis = normalizeAnalysisForMobile(
    {
      crisisId,
      executiveSummary: `Offline contextual analysis for ${focus.region ?? 'Pakistan'}.`,
      keyRisks: ['Resource contention', 'Alert fatigue'],
      affectedDomains: [focus.kind ?? 'incident'],
      coordinationNotes: ['Single EOC commander'],
    },
    crisisId,
    focus.id,
    'ContextualAlertOrchestrator',
    true,
  );

  const actionPlan = normalizeActionPlanForMobile(
    {
      crisisId,
      summary: `Fallback plan (rank ${focusRow?.rank ?? 1})`,
      tasks: [
        {
          taskId: 'verify',
          title: 'Verify incident and boundaries',
          priority: pri,
          etaMinutes: 15,
          etaLabel: '15 min',
          impactScore: 70,
          owner: 'District EOC',
          category: 'verification',
          rationale: 'Confirm before resource dispatch.',
        },
        {
          taskId: 'stage',
          title: 'Stage EMS and police per priority queue',
          priority: 'HIGH',
          etaMinutes: 12,
          etaLabel: '12 min',
          impactScore: 65,
          owner: 'Rescue 1122',
          category: 'medical',
          rationale: 'Higher-ranked alerts receive units first.',
        },
      ],
    },
    crisisId,
    focus.id,
    pri,
    'ContextualAlertOrchestrator',
    true,
  );

  return {
    focusSignalId: focus.id,
    crisisId,
    focusPriority: pri,
    focusRank: focusRow?.rank ?? 1,
    globalPrioritization: ranked,
    triage,
    analysis,
    actionPlan,
    recommendations: [
      'Run cloud-run with GROQ_API_KEY for live multi-alert reasoning.',
      `This alert is rank ${focusRow?.rank ?? 1} — defer non-critical tasks if needed.`,
    ],
    resourceAssignments: [],
    competingAlertsNote: `${Math.max(0, ranked.length - 1)} other alert(s) compete for the same pools.`,
    degradedMode: true,
    degradedAgents: ['AlertQueueAnalysisAgent', 'AlertTriageAgent', 'CrisisAnalysisAgent', 'ActionPlanAgent'],
    generatedAt: now(),
    agentName: 'ContextualAlertOrchestrator',
  };
}

/** Legacy server action plan (phases) → mobile bundle field. */
export function legacyActionPlanToMobile(
  plan: ActionPlanResult,
  defaultPriority: AgentPriority,
): MobileActionPlanResult {
  return normalizeActionPlanForMobile(
    plan as unknown as Record<string, unknown>,
    plan.crisisId,
    plan.signalId ?? '',
    defaultPriority,
    plan.agentName,
    plan.degradedMode,
  );
}
