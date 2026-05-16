import { db } from '../firebase-admin';
import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';

import { getWeatherData } from '../apis/weather';
import { getAirQualityWithFallback } from '../apis/airQuality';
import { searchCrisisSignals } from '../apis/social';
import { getHereTrafficIncidents } from '../apis/traffic';
import { getCachedNDMAAlerts } from '../scrapers/ndma';
import { getCachedPMDAlerts } from '../scrapers/pmd';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

function runRuleBasedFallback(agentName: string, payload: any): any {
  if (agentName === 'SignalFusionAgent') {
    const signals = payload.input?.signals || payload.signals || [];
    const fusedSignals = signals.map((s: any) => {
      let credibilityScore = 50;
      const src = (s.sourceType || s.source || '').toLowerCase();
      if (src === 'official' || src === 'pmd' || src === 'ndma') credibilityScore = 99;
      else if (src === 'weather' || src === 'open-meteo') credibilityScore = 94;
      else if (src === 'traffic' || src === 'here') credibilityScore = 91;
      
      return {
        ...s,
        credibilityScore,
        urgencyScore: 50,
        corroborationCount: 0,
        contradictionFlag: false,
        misinformationFlag: false
      };
    });
    return { fusedSignals };
  } else if (agentName === 'CrisisClassificationAgent') {
    // Return a single UNVERIFIED incident with severity Medium and confidence 40
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
          detectedAt: new Date().toISOString()
        }
      ]
    };
  } else {
    // Safe empty defaults
    if (agentName === 'SeverityPredictionAgent') return { predictions: [], note: "rule-based fallback active" };
    if (agentName === 'ResourceAllocationAgent') return { allocations: [], shortages: [], tradeoffs: [], note: "rule-based fallback active" };
    if (agentName === 'FalseAlarmAgent') return { falseAlarmChecks: [], note: "rule-based fallback active" };
    if (agentName === 'CompoundRiskAgent') return { compoundRisks: [], note: "rule-based fallback active" };
    if (agentName === 'StakeholderAlertAgent') return { alertDrafts: [], note: "rule-based fallback active" };
    return { note: "rule-based fallback active" };
  }
}

async function callAntigravityAgent(agentName: string, instruction: string, inputData: any, degradedAgentsTracker?: string[]) {
  const startTime = Date.now();
  const payload = { instruction, input: inputData };

  try {
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;

    const base = process.env.ANTIGRAVITY_AGENT_ENDPOINT || 'https://us-central1-aiplatform.googleapis.com/v1/projects/aegis-496207/locations/us-central1';
    const url = `${base}/publishers/google/models/gemini-1.5-pro:generateContent`;

    const body = {
      contents: [{
        parts: [{ text: JSON.stringify(payload) }]
      }]
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      throw new Error(`Vertex AI error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as any;
    let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Strip ```json fences
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Failed to parse JSON: ${responseText}`);
    }

    const latencyMs = Date.now() - startTime;

    // Write trace
    await db.collection('traces').add({
      agentName,
      input: payload,
      output: parsed,
      timestamp: new Date().toISOString(),
      latencyMs
    });

    return parsed;

  } catch (error: any) {
    console.error(`[${agentName}] Failed:`, error.message);
    
    if (degradedAgentsTracker) {
      degradedAgentsTracker.push(agentName);
    }

    await db.doc(`apiHealth/antigravity`).set({
      status: 'degraded',
      error: error.message,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return runRuleBasedFallback(agentName, payload);
  }
}

export async function runSignalIngestion() {
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

      await db.doc(`apiHealth/${source}`).set({
        status: 'live',
        count: signalsFromSource.length,
        updatedAt: new Date().toISOString()
      }, { merge: true });
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
  await batch.commit();

  // Step 2 - AGENT 1: SignalFusionAgent
  const agent1Instruction = `You are a crisis signal fusion agent for Islamabad/Rawalpindi, Pakistan (GCP project aegis-496207).
  
You receive raw signals from weather sensors, official government sources, traffic APIs, and social media.
Your job is to score each signal and flag problems before classification happens.

For each signal calculate:
1. credibilityScore (0-100):
   Base scores by source: PMD=99, NDMA=99, Open-Meteo=94, OpenAQ=96, HERE Maps=91,
   verified Twitter=75, unverified Twitter=50, Reddit=45.
   Modifiers: +15 if geo-tagged, +10 if corroborated by 2+ independent sources,
   -25 if text contains conspiracy language (hiding, fake data, government lies, سازش).

2. urgencyScore (0-100): based on language intensity, mention velocity, and sensor threshold breach.
   Thresholds for Pakistan context: rainfall > 50mm/hr = urgent, PM2.5 > 150 = urgent,
   temperature > 42C + humidity > 55% = urgent, visibility < 1km = urgent.

3. corroborationCount: number of other independent signals supporting the same event.

4. contradictionFlag: true if this signal directly contradicts another signal at the same location.
   Example: social post says flood, official source says only broken water main.

5. misinformationFlag: true if credibilityScore < 25 AND urgencyScore > 70.

Group signals by geographic cluster (within 2km radius) and time window (30 minutes).

Return JSON: { "fusedSignals": [ {"id": "...", "sourceType": "...", "credibilityScore": 0, "urgencyScore": 0, "corroborationCount": 0, "contradictionFlag": false, "misinformationFlag": false, "location": {}, "timestamp": "...", "raw": {}} ] }`;

  const fusedSignalsResult = await callAntigravityAgent('SignalFusionAgent', agent1Instruction, { signals: allSignals }, degradedAgents);
  const fusedSignals = fusedSignalsResult?.fusedSignals || [];

  const updateBatch = db.batch();
  for (const fs of fusedSignals) {
    if (fs.id) {
      updateBatch.set(db.collection('signals').doc(fs.id), fs, { merge: true });
    }
  }
  await updateBatch.commit();

  // Step 3 - AGENT 2: CrisisClassificationAgent
  const agent2Instruction = `You are a crisis classification agent for Islamabad/Rawalpindi, Pakistan.
  
You receive fused signals that have been scored for credibility and urgency.
Cluster signals by location and classify each cluster as a specific crisis type.

Crisis types and Pakistan-specific thresholds:
- Urban Flooding: rainfall > 50mm/hr OR social reports of flooding AND traffic congestion spike.
  Most flood-prone Islamabad sectors: G-10, G-9, I-9, I-10 (low-lying, poor drainage).
- Heatwave: temperature > 42C AND humidity > 55%. Vulnerable areas: kutchi abadis, I-8, G-8.
- Air Quality Emergency: PM2.5 > 150 µg/m³. Industrial zones: Margalla corridor, I-9 industrial.
- Dust Storm: visibility < 1km AND PM10 spike AND PMD advisory present.
- Infrastructure Failure: disambiguate from flooding using pressure loss signals or utility reports.
- Power Outage: multiple social reports of no power in same area with no weather explanation.
- Disease Cluster: NIH or health signals showing unusual hospital admission spikes.

For each classified crisis output:
- crisisType (from list above)
- severity: Low | Medium | High | Critical
- confidence: 0-100 percent
- status: UNVERIFIED (confidence < 40) | PROBABLE (40-70) | CONFIRMED (> 70)
- location: { lat, lng, label, affectedSectors[] }
- affectedPopulation: estimated number
- vulnerableCount: elderly, children, people with respiratory conditions
- conflictingHypotheses: array of alternative explanations if contradictionFlag was true,
  each with its own confidence score
- detectedAt: timestamp

If two signals contradict, list both hypotheses with their individual confidence scores.
Do not collapse contradictions — show the uncertainty explicitly.

Return JSON: { "incidents": [ {...} ] }`;

  const classificationsResult = await callAntigravityAgent('CrisisClassificationAgent', agent2Instruction, { fusedSignals }, degradedAgents);
  const incidents = classificationsResult?.incidents || [];

  for (const inc of incidents) {
    if (!inc.id) inc.id = db.collection('crises').doc().id;
    await db.collection('crises').doc(inc.id).set(inc);
  }

  // Step 4 - AGENT 3: SeverityPredictionAgent
  const agent3Instruction = `You are a crisis severity and evolution prediction agent for Pakistan.
  
Given classified crises and current weather forecast data, predict how each crisis will evolve.

For each crisis predict:
1. hourlyEvolution: array of 12 hourly severity scores (0-100) showing expected trajectory
2. peakSeverityTime: ISO timestamp when crisis is expected to be worst
3. expectedDurationHours: how long until crisis resolves naturally, with min/max range
4. geographicSpread: km radius expected after 1hr, 3hr, 6hr, 12hr
5. spreadRisk: Low | Medium | High — will this crisis spread to adjacent areas?
6. recoveryWithInterventionHours: how long with emergency response
7. recoveryWithoutInterventionHours: how long without any response
8. uncertaintyRange: percentage — how confident is this prediction

Pakistan seasonal context:
- Monsoon season June-September: flooding risk multiplies by 3x in low-lying sectors
- Industrial emission peaks: 08:00 and 18:00 PKT (shift changes)
- Dust storm corridor: approaches from Thar Desert via D.I. Khan, typical transit 3-5 hours
- Heatwave compounding: consecutive days above 40C increases vulnerable population risk by 1.5x

Compound risk rule: if heatwave AND air quality emergency are both active within 5km of each other,
flag compound: true and increase vulnerability estimates by 1.3x. Recommend joint medical response.

Return JSON: { "predictions": [ { "crisisId": "...", ...all fields above } ] }`;

  const weatherForecast = allSignals.find(s => s.sourceType === 'weather') || {};
  const predictionsResult = await callAntigravityAgent('SeverityPredictionAgent', agent3Instruction, {
    classifications: incidents,
    weatherForecast
  }, degradedAgents);
  
  const predictions = predictionsResult?.predictions || [];

  for (const pred of predictions) {
    if (pred.crisisId) {
      await db.collection('crises').doc(pred.crisisId).set(pred, { merge: true });
    }
  }

  // Step 5 - AGENT 4: ResourceAllocationAgent
  const inventoryDoc = await db.doc('resources/inventory').get();
  const resourceInventory = inventoryDoc.exists ? inventoryDoc.data() : { available: [] };

  const agent4Instruction = `You are a resource allocation agent for Pakistan emergency management.
  
You must allocate constrained emergency resources across all active simultaneous crises.
Never assume unlimited resources. Show explicit trade-offs when resources are shared.

Resource types available in Islamabad/Rawalpindi:
- Rescue 1122 teams (Punjab emergency service)
- CDA Emergency response units
- EDHI Foundation ambulances
- PIMS and Poly Clinic medical teams
- PEPA inspection and air quality units
- ICT Police units
- N95 mask distribution NGOs
- Water tankers (WASA)
- Drones for aerial assessment

Allocation priority formula:
priority = (vulnerablePopulation × severityScore) / (resourceCost × estimatedTravelTimeMinutes)

Rules:
- Never assign all ambulances to one crisis when 3+ crises are active simultaneously
- Pre-position mask distribution teams for confirmed incoming dust storms (zero cost, high benefit)
- Flag RESOURCE_SHORTAGE when a Critical crisis has no available resources
- Show which crisis loses resources when a higher-priority crisis appears
- Generate allocation rationale in both English and Urdu

For each allocation output:
- crisisId
- assignedResources: [ { type, unitId, eta, taskDescription } ]
- resourceShortages: [ { type, needed, available, gap } ]
- tradeoffs: description of what was sacrificed and why
- rationaleEnglish: plain English explanation
- rationaleUrdu: Urdu explanation

Return JSON: { "allocations": [...], "shortages": [...], "tradeoffs": [...] }`;

  const allocationsResult = await callAntigravityAgent('ResourceAllocationAgent', agent4Instruction, {
    incidents,
    currentResources: resourceInventory
  }, degradedAgents);

  const allocations = allocationsResult?.allocations || [];
  if (allocationsResult) {
    await db.doc('resources/inventory').set({ 
      lastAllocations: allocationsResult, 
      updatedAt: new Date().toISOString() 
    }, { merge: true });
  }

  // Step 6 - AGENT 5: FalseAlarmAgent
  const agent5Instruction = `You are a false alarm detection agent. Your job is to prevent unnecessary panic.
  
For each classified crisis, check for these false alarm indicators:
1. Sensor contradiction: official sensor data (PMD, OpenAQ) directly contradicts all social signals
   Example: AQI sensor reads 94 (Good) but 20 tweets say air is unbreathable
2. Single source: crisis has only one signal source and no corroboration after 15 minutes
3. Geo mismatch: social posts are geo-tagged to a different area than the crisis zone
4. Historical pattern: same location, same type, previously confirmed false alarm in /log

Pakistan-specific false alarm patterns to check:
- Community barbecue events in park sectors (F-7, G-6, E-11) regularly trigger false smoke/AQI alarms
  Rule: if AQI signal is weekend + park sector + no PMD advisory → flag for verification first
- Post-rain social panic: heavy rain often triggers social posts claiming flood when only waterlogging
  Rule: if rainfall < 30mm/hr AND social flood signal → classify as PROBABLE WATERLOGGING not flood
- Political gatherings: large public gatherings in D-Chowk or Constitution Avenue trigger police calls
  Rule: verify with traffic data before classifying as disorder

For each crisis output:
- crisisId
- falseAlarmProbability: 0-100 percent
- falseAlarmIndicators: array of matched indicators
- recommendedAction: CONFIRM | VERIFY_FIRST | RETRACT
- verificationSteps: what a field team should check
- If RETRACT: generate retractionMessage for each stakeholder type

Return JSON: { "falseAlarmChecks": [ {...} ] }`;

  const falseAlarmResult = await callAntigravityAgent('FalseAlarmAgent', agent5Instruction, {
    classifications: incidents,
    fusedSignals
  }, degradedAgents);
  
  const falseAlarmChecks = falseAlarmResult?.falseAlarmChecks || [];

  for (const check of falseAlarmChecks) {
    if (check.recommendedAction === 'RETRACT' && check.crisisId) {
      await db.collection('crises').doc(check.crisisId).set({
        status: 'false_alarm',
        retractionReason: check.falseAlarmIndicators?.join(', ') || 'Retracted by FalseAlarmAgent'
      }, { merge: true });
    }
  }

  // Step 7 - AGENT 6: CompoundRiskAgent
  const agent6Instruction = `You are a compound risk detection agent.
  
Check all pairs of active crises for compound risk interactions.
Two crises create a compound event when they are within 5km AND their health impacts overlap.

Compound risk rules:
1. Heatwave + Air Quality Emergency co-located (< 5km):
   Combined heat index + PM2.5 increases respiratory hospitalisation risk by 2.3x.
   Action: Revise vulnerable population upward. Recommend joint medical response.
   Alert: single unified health advisory instead of two separate alerts.

2. Dust Storm approaching + existing Air Quality Emergency:
   Combined PM10 + PM2.5 may push AQI toward 400+ (Hazardous).
   Action: Issue unified air quality advisory. Pre-position respiratory equipment.
   Timeline: give estimated time until compound peak.

3. Urban Flooding + Infrastructure Failure in same area:
   Flooding may be caused by or worsened by the infrastructure issue.
   Action: Dispatch both rescue and utility teams. Do not treat as separate events.

4. Heatwave + Power Outage:
   Loss of cooling during heatwave dramatically increases heat stroke risk for elderly.
   Action: Prioritise power restoration in residential and care home areas.

For each compound event output:
- incidentIds: the two crisis IDs
- compoundType: string description
- combinedRisk: Low | Medium | High | Critical
- revisedVulnerablePopulation: updated count
- recommendedJointResponse: description
- estimatedCompoundPeakTime: ISO timestamp

Return JSON: { "compoundRisks": [ {...} ] }`;

  const compoundRisksResult = await callAntigravityAgent('CompoundRiskAgent', agent6Instruction, { incidents }, degradedAgents);
  const compoundRisks = compoundRisksResult?.compoundRisks || [];

  for (const risk of compoundRisks) {
    for (const id of (risk.incidentIds || [])) {
      await db.collection('crises').doc(id).collection('compoundRisks').add(risk);
    }
  }

  // Step 8 - AGENT 7: StakeholderAlertAgent
  const agent7Instruction = `You are a stakeholder alert generation agent for Pakistan emergency management.
  
Generate tailored alert messages for 6 audience types for each active crisis.
Do NOT dispatch alerts. Write them to Firestore /alerts with status: pending_approval.
A human operator must approve before any alert is sent.

LANGUAGE RULE: Public SMS must be in Urdu (Pakistan's national language).
All official channel messages must be in English.

Audience types and channels:
1. PUBLIC: SMS via bulk gateway + NDMA WhatsApp broadcast
   Tone: Simple, calm, clear. No panic. What happened, which area, what to do right now.
   Format: Under 160 characters for SMS. Urdu script.

2. EMERGENCY_SERVICES: Rescue 1122, CDA Emergency, EDHI Foundation
   Tone: Technical, direct. Include: crisis type, severity, exact coordinates,
   resources allocated, ETAs, access routes.

3. HOSPITALS: PIMS Islamabad, Poly Clinic, CMH Rawalpindi, Shifa Hospital
   Tone: Medical, specific. Include: expected patient type (burns, respiratory, trauma, heat stroke),
   estimated count, arrival window, recommended preparations.

4. UTILITY_COMPANIES: WASA Islamabad, IESCO, SNGPL
   Tone: Technical, operational. Include: specific infrastructure affected,
   exact location coordinates, failure type, recommended action.

5. TRANSPORT_AUTHORITY: NHMP (motorway police), CAA Pakistan (airport if relevant), CDA traffic
   Tone: Operational. Include: affected roads, suggested alternate routes, expected congestion,
   estimated clearance time.

6. MEDIA_COMMAND: PTV, Geo TV, ARY News, ICS Command briefing
   Tone: Complete factual summary. Include: all hypotheses, confidence scores,
   resources deployed, what is confirmed vs unverified, next update time.

STAGING RULE — sequence alerts to prevent secondary crises:
For dust storm: Motorway closure notice first → then public advisory → then school/office dismissal.
This staggers traffic by ~40% vs simultaneous broadcast.
For flooding: Traffic rerouting first → then evacuation advisory.

For any crisis with conflictFlag=true: add to all messages:
'Note: Signal conflict detected. Treat with appropriate caution pending field verification.'

If FalseAlarmAgent recommended RETRACT for this crisis:
Generate retraction messages for all 6 audiences instead of alert messages.
Retraction must include: correction of what was wrong, apology for alarm, updated information.

Return JSON: { "alertDrafts": [ { "crisisId": "...", "audienceType": "...", "language": "...", "messageText": "...", "urduText": "...", "channel": "...", "staged": true, "stagingOrderIndex": 1, "compoundRiskNote": "..." } ] }`;

  const alertsResult = await callAntigravityAgent('StakeholderAlertAgent', agent7Instruction, {
    incidents,
    allocations,
    falseAlarmChecks,
    compoundRisks
  }, degradedAgents);
  
  const alertDrafts = alertsResult?.alertDrafts || [];

  for (const draft of alertDrafts) {
    if (draft.crisisId && draft.audienceType) {
      const docId = `${draft.crisisId}-${draft.audienceType}`;
      await db.collection('alerts').doc(docId).set({
        ...draft,
        status: 'pending_approval',
        generatedAt: new Date().toISOString()
      });
    }
  }

  // Final Summary Write
  const agentsRan = [
    'SignalFusionAgent', 'CrisisClassificationAgent', 'SeverityPredictionAgent',
    'ResourceAllocationAgent', 'FalseAlarmAgent', 'CompoundRiskAgent', 'StakeholderAlertAgent'
  ];

  await db.doc('antigravityPulse/latest').set({
    observations: [
      `Ingested ${allSignals.length} raw signals.`,
      `Classified ${incidents.length} potential crises.`,
      `Identified ${compoundRisks.length} compound risks.`,
      `Generated ${alertDrafts.length} pending stakeholder alerts.`,
      `Completed full pipeline analysis in ${Math.round((Date.now() - startTime)/1000)}s.`
    ],
    timestamp: new Date().toISOString(),
    signalCount: allSignals.length,
    crisisCount: incidents.length,
    agentsRan,
    degradedAgents: Array.from(new Set(degradedAgents)),
    project: 'aegis-496207'
  });

  return {
    success: true,
    data: {
      signals: fusedSignals,
      crises: incidents,
      predictions,
      allocations,
      falseAlarmChecks,
      compoundRisks,
      alertDrafts
    }
  };
}
