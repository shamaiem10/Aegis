import { db } from '../firebase-admin';
import { safeFirestoreWrite } from '../utils/safeFirestore';

import { callAntigravityAgent } from './agentClient';
import {
  compactUnitsForAgent,
  syncResourceInventoryToFirestore,
} from '../apis/resourceInventoryClient';
import { runCombinedOrchestrationAgent } from '../pipeline/combinedOrchestrationAgent';
import { getWeatherData } from '../apis/weather';
import { getAirQualityWithFallback } from '../apis/airQuality';
import { searchCrisisSignals } from '../apis/social';
import { getHereTrafficIncidents } from '../apis/traffic';
import { getCachedNDMAAlerts } from '../scrapers/ndma';
import { getCachedPMDAlerts } from '../scrapers/pmd';

export type SignalIngestionOptions = {
  supplementalSignals?: Record<string, unknown>[];
  scenarioId?: string;
  /** 2 Gemini calls (fusion + combined) instead of 7 sequential — ~3× faster */
  fastMode?: boolean;
};

const MAX_SIGNALS_FOR_AGENTS = Number(process.env.PIPELINE_MAX_SIGNALS) || 28;

function trimSignalsForAgents(signals: Record<string, unknown>[]): Record<string, unknown>[] {
  if (signals.length <= MAX_SIGNALS_FOR_AGENTS) return signals;
  const scored = [...signals].sort((a, b) => {
    const ua = Number(a.urgencyScore ?? a.severity_hint ?? 0);
    const ub = Number(b.urgencyScore ?? b.severity_hint ?? 0);
    return ub - ua;
  });
  return scored.slice(0, MAX_SIGNALS_FOR_AGENTS);
}

export async function runSignalIngestion(options?: SignalIngestionOptions) {
  const startTime = Date.now();
  const degradedAgents: string[] = [];

  // Step 1: Collect signals in parallel
  const results = await Promise.allSettled([
    getWeatherData(33.6844, 73.0479).then(res => ({ source: 'weather', data: res })),
    getAirQualityWithFallback({ lat: 33.7095, lng: 73.0421 }, 5000).then(res => ({ source: 'airQuality', data: res })),
    searchCrisisSignals().then(res => ({ source: 'social', data: res })),
    getHereTrafficIncidents(33.6844, 73.0479, 15000).then(res => ({ source: 'traffic', data: res })),
    getCachedPMDAlerts().then(res => ({ source: 'pmd', data: res })),
    getCachedNDMAAlerts().then(res => ({ source: 'ndma', data: res }))
  ]);

  let allSignals: any[] = [];
  const batch = db.batch();

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { source, data } = result.value;
      
      let signalsFromSource = Array.isArray(data) ? data : [data];
      
      signalsFromSource = signalsFromSource.filter(Boolean).map((s: any) => ({
        ...s,
        sourceType: source,
        id: s.id || db.collection('signals').doc().id,
        timestamp: s.timestamp || new Date().toISOString()
      }));

      allSignals.push(...signalsFromSource);

      await safeFirestoreWrite(`apiHealth/${source}`, () =>
        db.doc(`apiHealth/${source}`).set(
          {
            status: 'live',
            count: signalsFromSource.length,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        ),
      );
    } else {
      console.error(`Signal collection error:`, result.reason);
      // We don't fail the pipeline for one source error
    }
  }

  // Write all raw signals to Firestore
  for (const sig of allSignals) {
    const ref = db.collection('signals').doc(sig.id);
    batch.set(ref, sig);
  }
  await safeFirestoreWrite('signals.batch', () => batch.commit());

  if (options?.supplementalSignals?.length) {
    for (const s of options.supplementalSignals) {
      allSignals.push({
        ...s,
        sourceType: s.sourceType ?? "scenario",
        id: s.id || db.collection("signals").doc().id,
        timestamp: s.timestamp || new Date().toISOString(),
        scenarioId: options.scenarioId,
      });
    }
  }

  // Step 2 - AGENT 1: SignalFusionAgent
  const agent1Instruction = `Role: Score and cluster raw crisis signals for Islamabad/Rawalpindi PK.
Input: { signals: [{ id, sourceType, text, severity_hint, lat, lon, region }] } (max ~28)
Output JSON only:
{ "fusedSignals": [{ "id", "sourceType", "credibilityScore", "urgencyScore", "corroborationCount", "contradictionFlag", "misinformationFlag", "region" }] }
Rules: PMD/NDMA credibility 95–99; social lower; conspiracy language −25 credibility; keep input ids; no long text fields.`;

  const signalsForAgents = trimSignalsForAgents(allSignals);
  const compactSignals = signalsForAgents.map((s) => ({
    id: s.id,
    sourceType: s.sourceType ?? s.source,
    text: String(s.text ?? s.summary ?? "").slice(0, 160),
    severity_hint: s.severity_hint ?? s.urgencyScore,
    lat: s.lat,
    lon: s.lon,
    region: s.region,
  }));

  const fusedSignalsResult = await callAntigravityAgent(
    'SignalFusionAgent',
    agent1Instruction,
    { signals: compactSignals },
    degradedAgents,
  );
  const fusedSignals = fusedSignalsResult?.fusedSignals || [];

  const updateBatch = db.batch();
  for (const fs of fusedSignals) {
    if (fs.id) {
      updateBatch.set(db.collection('signals').doc(fs.id), fs, { merge: true });
    }
  }
  await safeFirestoreWrite('fusedSignals.batch', () => updateBatch.commit());

  // Step 3 - AGENT 2: CrisisClassificationAgent
  const agent2Instruction = `Role: Cluster fused signals into crisis incidents.
Input: { fusedSignals: [...] }
Output: { "incidents": [{ "id", "crisisId", "crisisType", "severity", "confidence", "status", "location": { "lat", "lng", "label", "affectedSectors" }, "detectedAt" }] }
Types: Urban Flooding, Heatwave, Air Quality Emergency, Traffic/Gridlock, Landslide, etc. Max 3 incidents.`;

  let incidents: Record<string, unknown>[] = [];
  let predictions: Record<string, unknown>[] = [];
  let allocations: Record<string, unknown>[] = [];
  let falseAlarmChecks: Record<string, unknown>[] = [];
  let compoundRisks: Record<string, unknown>[] = [];
  let alertDrafts: Record<string, unknown>[] = [];
  let actionPlans: Record<string, unknown>[] = [];

  const weatherForecast = allSignals.find((s) => s.sourceType === 'weather') || {};
  const inventoryBundle = await syncResourceInventoryToFirestore(false);
  const resourceInventory = {
    region: inventoryBundle.region,
    units: inventoryBundle.units,
    items: inventoryBundle.items,
    sources: inventoryBundle.sources,
    unitsForAgent: compactUnitsForAgent(inventoryBundle.units),
  };

  if (options?.fastMode) {
    const combined = await runCombinedOrchestrationAgent(
      fusedSignals,
      weatherForecast,
      degradedAgents,
      resourceInventory,
    );
    incidents = (combined.incidents as Record<string, unknown>[]) || [];
    predictions = (combined.predictions as Record<string, unknown>[]) || [];
    allocations = (combined.allocations as Record<string, unknown>[]) || [];
    falseAlarmChecks = (combined.falseAlarmChecks as Record<string, unknown>[]) || [];
    compoundRisks = (combined.compoundRisks as Record<string, unknown>[]) || [];
    alertDrafts = (combined.alertDrafts as Record<string, unknown>[]) || [];
    actionPlans = (combined.actionPlans as Record<string, unknown>[]) || [];
  } else {
    const classificationsResult = await callAntigravityAgent(
      'CrisisClassificationAgent',
      agent2Instruction,
      { fusedSignals },
      degradedAgents,
    );
    incidents = classificationsResult?.incidents || [];

    const agent3Instruction = `Role: 12h severity evolution per incident.
Input: { incidents, fusedSignals, weatherForecast? }
Output: { "predictions": [{ "crisisId", "spreadRisk", "peakSeverityTime", "uncertaintyRange" }] }`;

    const agent4Instruction = `Role: Assign EMS/fire/rescue under constraints (Islamabad inventory).
Input: { incidents, predictions? }
Output: { "allocations": [{ "crisisId", "assignedResources": [{ "type", "unitId", "eta", "taskDescription" }], "tradeoffs", "rationaleEnglish" }] }`;

    const agent5Instruction = `Role: Prevent bad public alerts — single-source, contradictions, drill keywords.
Input: { incidents, fusedSignals }
Output: { "falseAlarmChecks": [{ "crisisId", "recommendedAction": "CONFIRM"|"VERIFY_FIRST"|"RETRACT", "reason" }] }`;

    const [predictionsResult, allocationsResult, falseAlarmResult] = await Promise.all([
      callAntigravityAgent(
        'SeverityPredictionAgent',
        agent3Instruction,
        { classifications: incidents, weatherForecast },
        degradedAgents,
      ),
      callAntigravityAgent(
        'ResourceAllocationAgent',
        agent4Instruction,
        {
          incidents,
          currentResources: resourceInventory.unitsForAgent,
          allocationRule:
            'Only assign unitId values that exist in currentResources.resource_id. Never invent units.',
        },
        degradedAgents,
      ),
      callAntigravityAgent(
        'FalseAlarmAgent',
        agent5Instruction,
        { classifications: incidents, fusedSignals },
        degradedAgents,
      ),
    ]);

    predictions = predictionsResult?.predictions || [];
    allocations = allocationsResult?.allocations || [];
    falseAlarmChecks = falseAlarmResult?.falseAlarmChecks || [];

    if (allocationsResult) {
      await safeFirestoreWrite('resources/inventory', () =>
        db.doc('resources/inventory').set(
          { lastAllocations: allocationsResult, updatedAt: new Date().toISOString() },
          { merge: true },
        ),
      );
    }

    const agent6Instruction = `Role: Link co-located crises (heat × air quality, flood × traffic).
Input: { incidents, predictions }
Output: { "compoundRisks": [{ "crisisId", "linkedCrisisIds", "recommendation" }] }`;

    const compoundRisksResult = await callAntigravityAgent(
      'CompoundRiskAgent',
      agent6Instruction,
      { incidents },
      degradedAgents,
    );
    compoundRisks = compoundRisksResult?.compoundRisks || [];

    const agent7Instruction = `Role: Draft alerts for district ops + public (pending human approval).
Input: { incidents, falseAlarmChecks, compoundRisks }
Output: { "alertDrafts": [{ "crisisId", "audienceType", "title", "body" }] }
Skip RETRACT crises. English + optional short Urdu phrase in body only if needed.`;

    const alertsResult = await callAntigravityAgent(
      'StakeholderAlertAgent',
      agent7Instruction,
      { incidents, allocations, falseAlarmChecks, compoundRisks },
      degradedAgents,
    );
    alertDrafts = alertsResult?.alertDrafts || [];

    const agent8Instruction = `Role: Prioritize and generate action plan explicitly assigning units from the provided current resources.
Input: { incidents, currentResources }
Output: { "actionPlans": [{ "crisisId", "phases": [{ "name", "actions", "owner", "assignedResourceUnitId", "etaMin" }] }] }`;
    const actionPlanResult = await callAntigravityAgent(
      'ActionPlanAgent',
      agent8Instruction,
      { incidents, currentResources: resourceInventory.unitsForAgent },
      degradedAgents
    );
    actionPlans = actionPlanResult?.actionPlans || [];
  }

  // Convert actionPlans into alertDrafts so they are visible in the mobile app's Stakeholder/Alerts UI
  for (const plan of actionPlans) {
    if (!plan.crisisId) continue;
    const phases = (plan.phases as any[]) || [];
    const bodyText = phases.map(p => {
      const actionsRaw = p.actions || p.action || [];
      const actionsArray = Array.isArray(actionsRaw) ? actionsRaw : [actionsRaw];
      return `- ${p.name || 'Phase'} (Owner: ${p.owner || 'N/A'}, ETA: ${p.etaMin || 0}m)\n  Resources: ${p.assignedResourceUnitId || 'None'}\n  Actions: ${actionsArray.join(', ')}`;
    }).join('\n\n');
    
    alertDrafts.push({
      crisisId: plan.crisisId,
      audienceType: 'Action Plan',
      title: 'Global Operations Action Plan',
      body: bodyText
    });
  }

  let incIdx = 0;
  for (const inc of incidents) {
    if (!inc.id) {
      inc.id = `crisis-${Date.now()}-${incIdx++}`;
    }
    inc.crisisId = inc.crisisId || inc.id;
    await safeFirestoreWrite(`crises/${inc.id}`, () =>
      db.collection('crises').doc(inc.id as string).set(inc),
    );
  }

  for (const pred of predictions) {
    if (pred.crisisId) {
      await safeFirestoreWrite(`crises/${pred.crisisId}`, () =>
        db.collection('crises').doc(pred.crisisId as string).set(pred, { merge: true }),
      );
    }
  }

  for (const check of falseAlarmChecks) {
    if (check.recommendedAction === 'RETRACT' && check.crisisId) {
      await safeFirestoreWrite(`crises/${check.crisisId}/retract`, () =>
        db.collection('crises').doc(check.crisisId as string).set(
          {
            status: 'false_alarm',
            retractionReason:
              (check.reason as string | undefined) ||
              'Retracted by FalseAlarmAgent',
          },
          { merge: true },
        ),
      );
    }
  }

  for (const risk of compoundRisks) {
    for (const id of (risk.linkedCrisisIds as string[] | undefined) || []) {
      await safeFirestoreWrite(`compoundRisks/${id}`, () =>
        db.collection('crises').doc(id).collection('compoundRisks').add(risk),
      );
    }
  }

  for (const draft of alertDrafts) {
    if (draft.crisisId && draft.audienceType) {
      const docId = `${draft.crisisId}-${draft.audienceType}`;
      await safeFirestoreWrite(`alerts/${docId}`, () =>
        db.collection('alerts').doc(docId).set({
          ...draft,
          status: 'pending_approval',
          generatedAt: new Date().toISOString(),
        }),
      );
    }
  }

  const agentsRan = options?.fastMode
    ? ['SignalFusionAgent', 'CombinedOrchestrationAgent']
    : [
        'SignalFusionAgent',
        'CrisisClassificationAgent',
        'SeverityPredictionAgent',
        'ResourceAllocationAgent',
        'FalseAlarmAgent',
        'CompoundRiskAgent',
        'StakeholderAlertAgent',
      ];

  await safeFirestoreWrite('antigravityPulse/latest', () =>
    db.doc('antigravityPulse/latest').set({
      observations: [
        `Ingested ${allSignals.length} raw signals.`,
        `Classified ${incidents.length} potential crises.`,
        `Identified ${compoundRisks.length} compound risks.`,
        `Generated ${alertDrafts.length} pending stakeholder alerts.`,
        `Completed full pipeline analysis in ${Math.round((Date.now() - startTime) / 1000)}s.`,
      ],
      timestamp: new Date().toISOString(),
      signalCount: allSignals.length,
      crisisCount: incidents.length,
      agentsRan,
      degradedAgents: Array.from(new Set(degradedAgents)),
      project: process.env.GCP_PROJECT_ID || 'aegis-496207',
    }),
  );

  return {
    success: true,
    data: {
      signals: fusedSignals,
      crises: incidents,
      predictions,
      allocations,
      falseAlarmChecks,
      compoundRisks,
      alertDrafts,
    },
    degradedAgents,
    scenarioId: options?.scenarioId ?? null,
  };
}
