# Aegis — Antigravity agent manifest (crisis orchestration)

This project implements a **Google Antigravity–style multi-agent loop**: specialized agents propose structured outputs; the **fusion + planner** (`CrisisOrchestrator`) arbitrates conflicts, scores confidence, allocates constrained resources, simulates actions, and records a full **execution trace** on every dossier.

## Runtime roles (maps to Python modules)

| Antigravity agent | Responsibility | Module |
|-------------------|----------------|--------|
| **Signal Ingest** | Pull ≥3 families (hazards APIs, weather, social/traffic/911/sensor mocks); isolate failures; tag degraded mode | `tools/signals_loader.py`, `tools/supplemental_signals.py` |
| **Credibility / Misinformation** | Source trust, geo confidence, urgency language, velocity, contradictions | `tools/credibility.py` |
| **Fusion** | Time–space clustering; optional `incident_group` partitions for simultaneous incidents | `agents/signal_fusion/fusion.py` |
| **Classifier** | Crisis type + confidence; keyword + optional Gemini (Antigravity LLM) | `agents/crisis_classifier/classifier.py`, `tools/gemini_client.py` |
| **Severity & evolution** | Score + weather-linked factors; radii / duration / spread language in meta | `agents/severity_predictor/predictor.py` |
| **Resource allocator** | Constrained units across one or more incidents with trade-offs | `agents/resource_allocator/allocator.py` |
| **Action simulation** | Before / action / after, side effects, costs | `agents/action_simulator/simulator.py` |
| **Stakeholder comms** | Public, EMS, hospital, utility, transport, media/command templates | `agents/notifier/notifier.py` |
| **Planner / Recovery** | False positives, retractions, escalation; verification hooks | `agents/orchestrator/orchestrator.py` |

## Trace contract

Each pipeline run attaches `meta.antigravity_trace`: ordered steps with `agent`, `phase`, `detail`, `inputs_summary`, `outputs_summary`, `confidence`, optional `flags` (e.g. `conflicting_signals`, `degraded_source`, `recovery_retraction`).

LLM calls use `call_antigravity` in `tools/gemini_client.py` (structured Antigravity/Gemini integration). Traces are persisted on `CrisisDossier.meta` for dashboards and audit.

## Scenarios

Stress scenarios (e.g. dual Islamabad incidents) are available via `POST /api/v1/pipeline/run/scenario` with documented scenario ids (see `mock_data/supplemental_crisis_streams.json`).
