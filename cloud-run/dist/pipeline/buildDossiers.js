"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDossiersFromPipeline = buildDossiersFromPipeline;
exports.persistDossiers = persistDossiers;
const firebase_admin_1 = require("../firebase-admin");
const sanitizeFirestore_1 = require("../utils/sanitizeFirestore");
const actionSimulator_1 = require("./actionSimulator");
function severityLabelToScore(label, confidencePct) {
    const s = String(label ?? "Medium").toLowerCase();
    const base = s.includes("critical") ? 9 : s.includes("high") ? 7.5 : s.includes("low") ? 3.5 : 5.5;
    if (confidencePct != null && confidencePct > 80)
        return Math.min(10, base + 0.5);
    return base;
}
function crisisIdOf(inc) {
    return String(inc.id ?? inc.crisisId ?? inc.crisis_id ?? `crisis-${Date.now()}`);
}
function locOf(inc) {
    const loc = (inc.location ?? {});
    return {
        lat: Number(loc.lat ?? loc.latitude ?? 33.6844),
        lon: Number(loc.lng ?? loc.lon ?? loc.longitude ?? 73.0479),
        label: String(loc.label ?? inc.region ?? "Islamabad/Rawalpindi"),
    };
}
function fusedForIncident(incident, fusedSignals) {
    const { lat, lon, label } = locOf(incident);
    const nearby = fusedSignals.slice(0, 6).map((fs, i) => {
        const cred = Number(fs.credibilityScore ?? fs.credibility ?? 70);
        const urg = Number(fs.urgencyScore ?? fs.urgency ?? 50);
        const raw = (fs.raw ?? fs);
        return {
            id: String(fs.id ?? `fused-${i}`),
            summary: String(raw.text ?? raw.summary ?? fs.summary ?? `${fs.sourceType ?? "signal"} cluster`),
            lat: Number(raw.lat ?? lat),
            lon: Number(raw.lon ?? lon),
            region: String(raw.region ?? label),
            confidence: cred / 100,
            fused_severity_hint: Math.round(urg / 10),
        };
    });
    if (nearby.length)
        return nearby;
    return [
        {
            id: crisisIdOf(incident),
            summary: String(incident.crisisType ?? incident.crisis_type ?? "Fused incident cluster"),
            lat,
            lon,
            region: label,
            confidence: Number(incident.confidence ?? 50) / 100,
            fused_severity_hint: Math.round(severityLabelToScore(String(incident.severity))),
        },
    ];
}
function buildAntigravityTrace(agentsRan, signalCount, crisisCount, degraded) {
    const phases = [
        { agent: "SignalFusionAgent", phase: "fuse", detail: `Fused ${signalCount} raw signals into scored clusters.` },
        { agent: "CrisisClassificationAgent", phase: "classify", detail: `Classified ${crisisCount} simultaneous incidents.` },
        { agent: "SeverityPredictionAgent", phase: "predict", detail: "12h evolution + spread risk per crisis." },
        { agent: "ResourceAllocationAgent", phase: "allocate", detail: "Constrained allocation with explicit trade-offs." },
        { agent: "FalseAlarmAgent", phase: "verify", detail: "Contradiction + single-source checks before public alert." },
        { agent: "CompoundRiskAgent", phase: "compound", detail: "Heat × AQ proximity multiplier when co-located." },
        { agent: "StakeholderAlertAgent", phase: "draft", detail: "Pending approval drafts for district + public channels." },
    ];
    return phases
        .filter((p) => agentsRan.includes(p.agent))
        .map((p) => ({
        ...p,
        outputs_summary: p.agent,
        confidence: degraded.includes(p.agent) ? 0.55 : 0.82,
        ...(degraded.includes(p.agent) ? { flags: ["degraded_mode"] } : {}),
    }));
}
function mapAllocation(crisisId, allocations) {
    const row = allocations.find((a) => String(a.crisisId ?? a.crisis_id ?? "") === crisisId ||
        String(a.id ?? "") === crisisId) ?? allocations[0];
    if (!row) {
        return {
            units: [
                { resource_id: "rescue-1122", name: "Rescue 1122 team", quantity_available: 1 },
                { resource_id: "ems-amb", name: "EMS ambulance", quantity_available: 1 },
            ],
            notes: "Default staging — run full pipeline with inventory doc for optimized trade-offs.",
        };
    }
    const assigned = (row.assignedResources ?? row.units ?? []);
    const units = assigned.map((u, i) => ({
        resource_id: String(u.unitId ?? u.resource_id ?? `unit-${i}`),
        name: String(u.type ?? u.name ?? "Emergency unit"),
        quantity_available: Number(u.quantity ?? u.count ?? 1),
    }));
    const trade = row.tradeoffs ?? row.rationaleEnglish ?? row.rationale;
    return {
        units: units.length
            ? units
            : [{ resource_id: "staging", name: "Pre-positioned assets", quantity_available: 1 }],
        notes: String(trade ?? row.rationaleEnglish ?? "Allocation complete with documented trade-offs."),
    };
}
function mapNotifications(crisisId, alertDrafts) {
    return alertDrafts
        .filter((d) => String(d.crisisId ?? d.crisis_id ?? "") === crisisId)
        .map((d) => ({
        channel: String(d.audienceType ?? d.channel ?? "stakeholder"),
        title: String(d.title ?? "Pending stakeholder alert"),
        body: String(d.body ?? d.message ?? d.bodyEnglish ?? ""),
    }));
}
function buildDossiersFromPipeline(payload, opts) {
    const fusedSignals = (payload.signals ?? []);
    const incidents = (payload.crises ?? []);
    const predictions = (payload.predictions ?? []);
    const allocations = (payload.allocations ?? []);
    const falseChecks = (payload.falseAlarmChecks ?? []);
    const compoundRisks = (payload.compoundRisks ?? []);
    const alertDrafts = (payload.alertDrafts ?? []);
    const agentsRan = [
        "SignalFusionAgent",
        "CrisisClassificationAgent",
        "SeverityPredictionAgent",
        "ResourceAllocationAgent",
        "FalseAlarmAgent",
        "CompoundRiskAgent",
        "StakeholderAlertAgent",
    ];
    const degraded = opts?.degradedAgents ?? [];
    const now = new Date().toISOString();
    if (!incidents.length) {
        const fallbackId = `pipeline-${Date.now()}`;
        return [
            {
                crisis_id: fallbackId,
                status: "monitoring",
                fused: fusedForIncident({}, fusedSignals),
                classification: {
                    category: "Monitoring",
                    confidence: 0.4,
                    rationale: "Pipeline completed but no classified incidents — check signal feeds or Gemini quota.",
                },
                severity: { score: 4, factors: ["No incident cluster"], weather_note: null },
                allocation: mapAllocation(fallbackId, allocations),
                notifications: [],
                created_at: now,
                meta: {
                    antigravity_trace: buildAntigravityTrace(agentsRan, fusedSignals.length, 0, degraded),
                    pipeline_degraded: degraded,
                    scenario_id: opts?.scenarioId,
                },
            },
        ];
    }
    const sorted = [...incidents].sort((a, b) => {
        const sa = severityLabelToScore(String(a.severity), Number(a.confidence));
        const sb = severityLabelToScore(String(b.severity), Number(b.confidence));
        return sb - sa;
    });
    return sorted.map((inc, idx) => {
        const crisisId = crisisIdOf(inc);
        const pred = predictions.find((p) => String(p.crisisId ?? p.crisis_id) === crisisId) ??
            predictions[idx];
        const falseRow = falseChecks.find((f) => String(f.crisisId ?? f.crisis_id) === crisisId);
        const compound = compoundRisks.find((c) => String(c.crisisId ?? c.crisis_id ?? c.primaryCrisisId) === crisisId ||
            (Array.isArray(c.linkedCrisisIds) &&
                c.linkedCrisisIds.includes(crisisId)));
        const category = String(inc.crisisType ?? inc.crisis_type ?? inc.category ?? "Unknown");
        const confPct = Number(inc.confidence ?? 60);
        const sevScore = severityLabelToScore(String(inc.severity), confPct);
        const region = locOf(inc).label;
        const fused = fusedForIncident(inc, fusedSignals);
        const isFalse = falseRow?.recommendation === "RETRACT" ||
            falseRow?.isFalseAlarm === true ||
            String(inc.status ?? "").toUpperCase() === "FALSE_ALARM";
        const hypotheses = (inc.conflictingHypotheses ?? []);
        const simActions = (0, actionSimulator_1.simulateResponseActions)(category, sevScore, region);
        const auditLog = [
            { ts: now, event: "pipeline.run", crisis_id: crisisId, scenario: opts?.scenarioId ?? null },
            {
                ts: now,
                event: "allocation.tradeoff",
                note: mapAllocation(crisisId, allocations).notes,
            },
            ...(degraded.length
                ? [{ ts: now, event: "agents.degraded", agents: degraded.join(", ") }]
                : []),
        ];
        const linked = compound
            ? {
                linked_crisis_id: String(compound.linkedCrisisIds?.[0] ??
                    compound.secondaryCrisisId ??
                    ""),
                linked_title: String(compound.secondaryType ?? compound.title ?? "Linked crisis"),
                body: String(compound.recommendation ??
                    compound.body ??
                    "Compound environmental risk — coordinate joint medical + AQ response."),
            }
            : undefined;
        return {
            crisis_id: crisisId,
            status: isFalse ? "false_alarm" : confPct >= 70 ? "active" : "monitoring",
            fused,
            classification: {
                category,
                confidence: confPct / 100,
                rationale: hypotheses.length > 0
                    ? `Conflicting hypotheses retained (${hypotheses.length}). Primary: ${category}.`
                    : `${String(inc.status ?? "PROBABLE")} — ${region}. Pop ~${Number(inc.affectedPopulation ?? 0)}.`,
            },
            severity: {
                score: sevScore,
                factors: [
                    `Severity band: ${String(inc.severity ?? "Medium")}`,
                    pred?.spreadRisk ? `Spread risk: ${String(pred.spreadRisk)}` : "Spread risk assessed",
                    pred?.peakSeverityTime
                        ? `Peak expected: ${String(pred.peakSeverityTime)}`
                        : "Evolution model attached in meta",
                ],
                weather_note: pred?.uncertaintyRange
                    ? `Forecast uncertainty ±${String(pred.uncertaintyRange)}%`
                    : null,
            },
            allocation: mapAllocation(crisisId, allocations),
            notifications: mapNotifications(crisisId, alertDrafts),
            created_at: String(inc.detectedAt ?? now),
            meta: {
                crisis_type: category,
                display_name: `${region} · ${category}`,
                antigravity_trace: buildAntigravityTrace(agentsRan, fusedSignals.length, incidents.length, degraded),
                action_simulation: simActions,
                audit_log: auditLog,
                pipeline_degraded: degraded,
                pipeline_duration_sec: opts?.durationSec,
                scenario_id: opts?.scenarioId,
                prediction: pred ?? null,
                false_alarm_check: falseRow ?? null,
                false_alarm_reason: falseRow?.reason ?? falseRow?.rationale ?? null,
                compound_risk: linked,
                resource_tradeoffs: allocations.find((a) => String(a.crisisId) === crisisId)?.tradeoffs,
                multi_crisis_index: idx,
                multi_crisis_total: incidents.length,
                affected_population: inc.affectedPopulation,
                vulnerable_count: inc.vulnerableCount,
                hypothesis_conflict: hypotheses.length > 0,
                hypothesis_a: hypotheses[0] != null
                    ? {
                        title: String(hypotheses[0].description ?? hypotheses[0].title ?? "Hypothesis A"),
                        confidence_pct: Number(hypotheses[0].confidence ?? 50),
                        signals: Number(hypotheses[0].signalCount ?? 1),
                    }
                    : undefined,
                hypothesis_b: hypotheses[1] != null
                    ? {
                        title: String(hypotheses[1].description ?? hypotheses[1].title ?? "Hypothesis B"),
                        confidence_pct: Number(hypotheses[1].confidence ?? 30),
                        signals: Number(hypotheses[1].signalCount ?? 1),
                    }
                    : undefined,
                credibility_scores: fused.map((f) => ({
                    signal_id: f.id,
                    credibility: f.confidence,
                })),
                agents_ran: agentsRan,
            },
        };
    });
}
async function persistDossiers(dossiers) {
    const batch = firebase_admin_1.db.batch();
    for (const d of dossiers) {
        const ref = firebase_admin_1.db.collection("crises").doc(d.crisis_id);
        const clean = (0, sanitizeFirestore_1.sanitizeForFirestore)(d);
        batch.set(ref, (0, sanitizeFirestore_1.sanitizeForFirestore)({
            dossier: clean,
            crisis_id: d.crisis_id,
            created_at: d.created_at,
            status: d.status,
            classification: d.classification,
            severity: d.severity,
            updatedAt: new Date().toISOString(),
        }), { merge: true });
    }
    await batch.commit();
    if (dossiers[0]) {
        await firebase_admin_1.db.doc("pipeline/latest").set((0, sanitizeFirestore_1.sanitizeForFirestore)({
            primaryCrisisId: dossiers[0].crisis_id,
            dossierIds: dossiers.map((doc) => doc.crisis_id),
            updatedAt: new Date().toISOString(),
        }));
    }
}
