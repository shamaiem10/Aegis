"use strict";
/** Deterministic response-action blocks (mirrors Python action_simulator). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulateResponseActions = simulateResponseActions;
function simulateResponseActions(category, severityScore, region) {
    const sev = Math.max(1, Math.min(10, severityScore));
    const cat = category.toLowerCase();
    const actions = [];
    actions.push({
        action_id: "traffic_reroute",
        before_state: `Corridor congestion index high around ${region}; EMS ETA elongated.`,
        response_action: "Staged detour + contraflow on feeder ramps; pause non-essential entries.",
        expected_after_state: "EMS ingress improved; residual queue on parallel arterial.",
        response_time_improvement_min: Math.max(3, 10 - Math.floor(sev / 2)),
        congestion_impact: "Short-term spike on bypass, clears in ~25–40 min",
        resource_cost_units: 2.5,
        possible_side_effects: [
            "Evacuation rush if public wording too alarming — use tiered alerting.",
            "Transit overlap if not coordinated with metro bus lane.",
        ],
    });
    actions.push({
        action_id: "ems_dispatch",
        before_state: `Field teams balancing ${category} workload with travel friction.`,
        response_action: "Pre-position EMS + cooling assets on downwind / downhill approach vectors.",
        expected_after_state: "Earlier triage contact; fewer late-stage heat / trauma presentations.",
        response_time_improvement_min: 4 + Math.floor(sev / 3),
        congestion_impact: "Minimal if staging off main carriageway",
        resource_cost_units: 3.0,
        possible_side_effects: ["Hospital surge if transport not pre-alerted"],
    });
    if (/flood|infrastructure|utility|waterlog/.test(cat)) {
        actions.push({
            action_id: "utility_escalate",
            before_state: "Unclear if inundation vs pressurized main breach — risk of wrong public hazard.",
            response_action: "Open utility war-room ticket; request pressure telemetry + valve isolation plan.",
            expected_after_state: "Narrow hypothesis space; safer correction path if flood alert was false.",
            response_time_improvement_min: null,
            congestion_impact: "Low",
            resource_cost_units: 1.0,
            possible_side_effects: [
                "Temporary service interruption during sectional isolation",
                "Social noise if outage not explained",
            ],
        });
    }
    if (/power|outage|grid/.test(cat)) {
        actions.push({
            action_id: "grid_restoration",
            before_state: "Feeders overloaded or transmission trip — cold-load pick-up risk.",
            response_action: "Rolling mobile gens + switching plan; staged re-energize hospitals first.",
            expected_after_state: "Critical loads stabilized within SLA; broader grid in phased restore.",
            response_time_improvement_min: 8,
            congestion_impact: "Fuel truck queues near substations if not pre-staged",
            resource_cost_units: 3.5,
            possible_side_effects: [
                "Voltage flicker in adjacent feeders",
                "False sense of all-clear if only partial restore",
            ],
        });
    }
    if (/heat/.test(cat)) {
        actions.push({
            action_id: "cooling_outreach",
            before_state: "Vulnerable clusters in dense housing; grid sag risk.",
            response_action: "Shelter activation + ORS distribution + staged fan / generator drops.",
            expected_after_state: "Heat index exposure reduced for high-risk cohorts.",
            response_time_improvement_min: 6,
            congestion_impact: "Shuttle buses may add local load",
            resource_cost_units: 2.0,
            possible_side_effects: ["Generator noise complaints", "Parking pressure near shelter"],
        });
    }
    actions.push({
        action_id: "public_alert",
        before_state: "Low situational awareness off immediate corridor.",
        response_action: "Geo-fenced push + SMS stub: instruct avoid vs staged evac language by confidence.",
        expected_after_state: "Demand smoothed; fewer spontaneous contra-flow drivers.",
        response_time_improvement_min: 2,
        congestion_impact: "Moderate if blanket evac — prefer concentric rings",
        resource_cost_units: 0.5,
        possible_side_effects: [
            "Misinformation amplification if not linked to official hotline",
        ],
    });
    return actions;
}
