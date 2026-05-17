"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSignalIngestion = runSignalIngestion;
const firebase_admin_1 = require("../firebase-admin");
const safeFirestore_1 = require("../utils/safeFirestore");
const agentClient_1 = require("./agentClient");
const resourceInventoryClient_1 = require("../apis/resourceInventoryClient");
const combinedOrchestrationAgent_1 = require("../pipeline/combinedOrchestrationAgent");
const weather_1 = require("../apis/weather");
const airQuality_1 = require("../apis/airQuality");
const social_1 = require("../apis/social");
const traffic_1 = require("../apis/traffic");
const ndma_1 = require("../scrapers/ndma");
const pmd_1 = require("../scrapers/pmd");
const MAX_SIGNALS_FOR_AGENTS = Number(process.env.PIPELINE_MAX_SIGNALS) || 28;
function trimSignalsForAgents(signals) {
    if (signals.length <= MAX_SIGNALS_FOR_AGENTS)
        return signals;
    const scored = [...signals].sort((a, b) => {
        const ua = Number(a.urgencyScore ?? a.severity_hint ?? 0);
        const ub = Number(b.urgencyScore ?? b.severity_hint ?? 0);
        return ub - ua;
    });
    return scored.slice(0, MAX_SIGNALS_FOR_AGENTS);
}
async function runSignalIngestion(options) {
    const startTime = Date.now();
    const degradedAgents = [];
    // Step 1: Collect signals in parallel
    const results = await Promise.allSettled([
        (0, weather_1.getWeatherData)(33.6844, 73.0479).then(res => ({ source: 'weather', data: res })),
        (0, airQuality_1.getAirQualityWithFallback)({ lat: 33.7095, lng: 73.0421 }, 5000).then(res => ({ source: 'airQuality', data: res })),
        (0, social_1.searchCrisisSignals)().then(res => ({ source: 'social', data: res })),
        (0, traffic_1.getHereTrafficIncidents)(33.6844, 73.0479, 15000).then(res => ({ source: 'traffic', data: res })),
        (0, pmd_1.getCachedPMDAlerts)().then(res => ({ source: 'pmd', data: res })),
        (0, ndma_1.getCachedNDMAAlerts)().then(res => ({ source: 'ndma', data: res }))
    ]);
    let allSignals = [];
    const batch = firebase_admin_1.db.batch();
    for (const result of results) {
        if (result.status === 'fulfilled') {
            const { source, data } = result.value;
            let signalsFromSource = Array.isArray(data) ? data : [data];
            signalsFromSource = signalsFromSource.filter(Boolean).map((s) => ({
                ...s,
                sourceType: source,
                id: s.id || firebase_admin_1.db.collection('signals').doc().id,
                timestamp: s.timestamp || new Date().toISOString()
            }));
            allSignals.push(...signalsFromSource);
            await (0, safeFirestore_1.safeFirestoreWrite)(`apiHealth/${source}`, () => firebase_admin_1.db.doc(`apiHealth/${source}`).set({
                status: 'live',
                count: signalsFromSource.length,
                updatedAt: new Date().toISOString(),
            }, { merge: true }));
        }
        else {
            console.error(`Signal collection error:`, result.reason);
            // We don't fail the pipeline for one source error
        }
    }
    // Write all raw signals to Firestore
    for (const sig of allSignals) {
        const ref = firebase_admin_1.db.collection('signals').doc(sig.id);
        batch.set(ref, sig);
    }
    await (0, safeFirestore_1.safeFirestoreWrite)('signals.batch', () => batch.commit());
    if (options?.supplementalSignals?.length) {
        for (const s of options.supplementalSignals) {
            allSignals.push({
                ...s,
                sourceType: s.sourceType ?? "scenario",
                id: s.id || firebase_admin_1.db.collection("signals").doc().id,
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
    const fusedSignalsResult = await (0, agentClient_1.callAntigravityAgent)('SignalFusionAgent', agent1Instruction, { signals: compactSignals }, degradedAgents);
    const fusedSignals = fusedSignalsResult?.fusedSignals || [];
    const updateBatch = firebase_admin_1.db.batch();
    for (const fs of fusedSignals) {
        if (fs.id) {
            updateBatch.set(firebase_admin_1.db.collection('signals').doc(fs.id), fs, { merge: true });
        }
    }
    await (0, safeFirestore_1.safeFirestoreWrite)('fusedSignals.batch', () => updateBatch.commit());
    // Step 3 - AGENT 2: CrisisClassificationAgent
    const agent2Instruction = `Role: Cluster fused signals into crisis incidents.
Input: { fusedSignals: [...] }
Output: { "incidents": [{ "id", "crisisId", "crisisType", "severity", "confidence", "status", "location": { "lat", "lng", "label", "affectedSectors" }, "detectedAt" }] }
Types: Urban Flooding, Heatwave, Air Quality Emergency, Traffic/Gridlock, Landslide, etc. Max 3 incidents.`;
    let incidents = [];
    let predictions = [];
    let allocations = [];
    let falseAlarmChecks = [];
    let compoundRisks = [];
    let alertDrafts = [];
    let actionPlans = [];
    const weatherForecast = allSignals.find((s) => s.sourceType === 'weather') || {};
    const inventoryBundle = await (0, resourceInventoryClient_1.syncResourceInventoryToFirestore)(false);
    const resourceInventory = {
        region: inventoryBundle.region,
        units: inventoryBundle.units,
        items: inventoryBundle.items,
        sources: inventoryBundle.sources,
        unitsForAgent: (0, resourceInventoryClient_1.compactUnitsForAgent)(inventoryBundle.units),
    };
    if (options?.fastMode) {
        const combined = await (0, combinedOrchestrationAgent_1.runCombinedOrchestrationAgent)(fusedSignals, weatherForecast, degradedAgents, resourceInventory);
        incidents = combined.incidents || [];
        predictions = combined.predictions || [];
        allocations = combined.allocations || [];
        falseAlarmChecks = combined.falseAlarmChecks || [];
        compoundRisks = combined.compoundRisks || [];
        alertDrafts = combined.alertDrafts || [];
        actionPlans = combined.actionPlans || [];
    }
    else {
        const classificationsResult = await (0, agentClient_1.callAntigravityAgent)('CrisisClassificationAgent', agent2Instruction, { fusedSignals }, degradedAgents);
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
            (0, agentClient_1.callAntigravityAgent)('SeverityPredictionAgent', agent3Instruction, { classifications: incidents, weatherForecast }, degradedAgents),
            (0, agentClient_1.callAntigravityAgent)('ResourceAllocationAgent', agent4Instruction, {
                incidents,
                currentResources: resourceInventory.unitsForAgent,
                allocationRule: 'Only assign unitId values that exist in currentResources.resource_id. Never invent units.',
            }, degradedAgents),
            (0, agentClient_1.callAntigravityAgent)('FalseAlarmAgent', agent5Instruction, { classifications: incidents, fusedSignals }, degradedAgents),
        ]);
        predictions = predictionsResult?.predictions || [];
        allocations = allocationsResult?.allocations || [];
        falseAlarmChecks = falseAlarmResult?.falseAlarmChecks || [];
        if (allocationsResult) {
            await (0, safeFirestore_1.safeFirestoreWrite)('resources/inventory', () => firebase_admin_1.db.doc('resources/inventory').set({ lastAllocations: allocationsResult, updatedAt: new Date().toISOString() }, { merge: true }));
        }
        const agent6Instruction = `Role: Link co-located crises (heat × air quality, flood × traffic).
Input: { incidents, predictions }
Output: { "compoundRisks": [{ "crisisId", "linkedCrisisIds", "recommendation" }] }`;
        const compoundRisksResult = await (0, agentClient_1.callAntigravityAgent)('CompoundRiskAgent', agent6Instruction, { incidents }, degradedAgents);
        compoundRisks = compoundRisksResult?.compoundRisks || [];
        const agent7Instruction = `Role: Draft alerts for district ops + public (pending human approval).
Input: { incidents, falseAlarmChecks, compoundRisks }
Output: { "alertDrafts": [{ "crisisId", "audienceType", "title", "body" }] }
Skip RETRACT crises. English + optional short Urdu phrase in body only if needed.`;
        const alertsResult = await (0, agentClient_1.callAntigravityAgent)('StakeholderAlertAgent', agent7Instruction, { incidents, allocations, falseAlarmChecks, compoundRisks }, degradedAgents);
        alertDrafts = alertsResult?.alertDrafts || [];
        const agent8Instruction = `Role: Prioritize and generate action plan explicitly assigning units from the provided current resources.
Input: { incidents, currentResources }
Output: { "actionPlans": [{ "crisisId", "phases": [{ "name", "actions", "owner", "assignedResourceUnitId", "etaMin" }] }] }`;
        const actionPlanResult = await (0, agentClient_1.callAntigravityAgent)('ActionPlanAgent', agent8Instruction, { incidents, currentResources: resourceInventory.unitsForAgent }, degradedAgents);
        actionPlans = actionPlanResult?.actionPlans || [];
    }
    // Convert actionPlans into alertDrafts so they are visible in the mobile app's Stakeholder/Alerts UI
    for (const plan of actionPlans) {
        if (!plan.crisisId)
            continue;
        const phases = plan.phases || [];
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
        await (0, safeFirestore_1.safeFirestoreWrite)(`crises/${inc.id}`, () => firebase_admin_1.db.collection('crises').doc(inc.id).set(inc));
    }
    for (const pred of predictions) {
        if (pred.crisisId) {
            await (0, safeFirestore_1.safeFirestoreWrite)(`crises/${pred.crisisId}`, () => firebase_admin_1.db.collection('crises').doc(pred.crisisId).set(pred, { merge: true }));
        }
    }
    for (const check of falseAlarmChecks) {
        if (check.recommendedAction === 'RETRACT' && check.crisisId) {
            await (0, safeFirestore_1.safeFirestoreWrite)(`crises/${check.crisisId}/retract`, () => firebase_admin_1.db.collection('crises').doc(check.crisisId).set({
                status: 'false_alarm',
                retractionReason: check.reason ||
                    'Retracted by FalseAlarmAgent',
            }, { merge: true }));
        }
    }
    for (const risk of compoundRisks) {
        for (const id of risk.linkedCrisisIds || []) {
            await (0, safeFirestore_1.safeFirestoreWrite)(`compoundRisks/${id}`, () => firebase_admin_1.db.collection('crises').doc(id).collection('compoundRisks').add(risk));
        }
    }
    for (const draft of alertDrafts) {
        if (draft.crisisId && draft.audienceType) {
            const docId = `${draft.crisisId}-${draft.audienceType}`;
            await (0, safeFirestore_1.safeFirestoreWrite)(`alerts/${docId}`, () => firebase_admin_1.db.collection('alerts').doc(docId).set({
                ...draft,
                messageText: String(draft.body ?? draft.messageText ?? ''),
                englishText: String(draft.body ?? draft.englishText ?? ''),
                status: 'pending_approval',
                generatedAt: new Date().toISOString(),
                issuedAt: new Date().toISOString(),
            }));
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
    await (0, safeFirestore_1.safeFirestoreWrite)('antigravityPulse/latest', () => firebase_admin_1.db.doc('antigravityPulse/latest').set({
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
    }));
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
