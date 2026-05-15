import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, PageHeader, Pill } from "@/components/aegis/AppShell";
import { Droplets, Thermometer, Zap, Radio, AlertTriangle, RotateCcw, Play, Server } from "lucide-react";
import { fetchHealth, getConfiguredApiBase, runPipeline, setConfiguredApiBase } from "@/lib/aegis-api";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

const scenarios = [
  { id: "flood", icon: Droplets, label: "Trigger Flood Scenario", color: "sky", body: "Spawns CRS-Sim-1 in F-10 with 5 supporting signals over 90s." },
  { id: "heat", icon: Thermometer, label: "Trigger Heatwave Scenario", color: "amber", body: "Heat index ramps to 47°C in I-9; cooling demand alerts triggered." },
  { id: "both", icon: AlertTriangle, label: "Trigger Both Simultaneously", color: "alert", body: "Stress-test multi-crisis arbitration with shared resource pool." },
  { id: "false", icon: Radio, label: "Inject False Signal", color: "amber", body: "High-velocity social post with low corroboration → tests retraction flow." },
  { id: "down", icon: Zap, label: "Simulate API Failure", color: "alert", body: "Takes Sensor Gateway offline → forces degraded mode." },
];

function SettingsPage() {
  const queryClient = useQueryClient();
  const [city, setCity] = useState("Islamabad");
  const [useReal, setUseReal] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [last, setLast] = useState<string | null>(null);

  const [apiDraft, setApiDraft] = useState(() => getConfiguredApiBase() || "");
  const [healthMsg, setHealthMsg] = useState<string | null>(null);
  const [ingestBusy, setIngestBusy] = useState(false);

  const saveBackend = async () => {
    setConfiguredApiBase(apiDraft);
    setHealthMsg(null);
    try {
      await fetchHealth();
      setHealthMsg("Backend reachable ✅");
      await queryClient.invalidateQueries({ queryKey: ["aegis-crises"] });
    } catch (e) {
      setHealthMsg(`Cannot reach backend: ${String((e as Error).message ?? e)}`);
    }
  };

  const firePipeline = async () => {
    if (!getConfiguredApiBase()) {
      setHealthMsg("Set API base URL first.");
      return;
    }
    setIngestBusy(true);
    try {
      await runPipeline({ include_weather: true, use_llm_classifier: false });
      setLast("Pipeline run dispatched");
      await queryClient.invalidateQueries({ queryKey: ["aegis-crises"] });
    } catch (e) {
      setHealthMsg(`Pipeline failed: ${String((e as Error).message ?? e)}`);
    } finally {
      setIngestBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Screen 12"
        title="Demo Control Panel"
        sub="For hackathon demos only. Inject scenarios, choose data sources, and control simulation speed."
        right={<Pill tone="amber">⚠️ DEMO MODE</Pill>}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
        <Card className="border-primary/40 bg-muted/40">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white">
              <Server size={18} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <h3 className="text-sm font-bold">FastAPI backend</h3>
              <p className="text-[11px] text-ink-soft">
                Mirrors <code className="rounded bg-muted px-1">VITE_API_URL</code> or override here (saved in browser). Google Maps /
                Gemini keys stay in backend <code>.env</code>; this field is only base URL + port.
              </p>
              <input
                value={apiDraft}
                onChange={(e) => setApiDraft(e.target.value)}
                placeholder="http://127.0.0.1:8000"
                className="mt-1 w-full rounded-2xl border border-border bg-white px-4 py-2 text-xs outline-none ring-primary/40 focus:ring"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => saveBackend()}
                  className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white"
                >
                  Save & ping /health
                </button>
                <button
                  type="button"
                  disabled={ingestBusy}
                  onClick={() => firePipeline()}
                  className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-ink-soft hover:border-ink/40 hover:text-ink disabled:opacity-50"
                >
                  {ingestBusy ? "Running…" : "POST /pipeline/run"}
                </button>
              </div>
              {healthMsg && (
                <p className={`text-[11px] ${healthMsg.includes("✅") ? "text-emerald-700" : "text-alert"}`}>
                  {healthMsg}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Scenario buttons */}
        <Card>
          <h3 className="text-sm font-bold">Inject mock scenarios</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {scenarios.map(s => {
              const Icon = s.icon;
              return (
                <button key={s.id} onClick={() => setLast(s.label)}
                  className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-calm">
                    <Icon size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{s.label}</p>
                    <p className="mt-0.5 text-[11px] text-ink-soft">{s.body}</p>
                  </div>
                  <Play size={14} className="mt-1 text-ink-soft transition group-hover:translate-x-0.5" />
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-alert/10 p-4">
            <div className="flex items-center gap-3">
              <RotateCcw size={18} className="text-[color:var(--alert-deep)]" />
              <div>
                <p className="text-sm font-semibold text-[color:var(--alert-deep)]">Reset all simulations</p>
                <p className="text-[11px] text-ink-soft">Clears every injected crisis, restores baseline city state.</p>
              </div>
            </div>
            <button onClick={() => setLast("Reset")} className="rounded-full bg-alert px-4 py-2 text-xs font-semibold text-white">Reset</button>
          </div>

          {last && (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-mint/40 px-4 py-2 text-xs">
              <span className="font-semibold text-emerald-900">✓ {last} dispatched</span>
              <span className="text-ink-soft">{new Date().toLocaleTimeString()}</span>
            </div>
          )}
        </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-bold">City</h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {["Islamabad", "Karachi", "Lahore"].map(c => (
                <button key={c} onClick={() => setCity(c)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${city === c ? "bg-ink text-white" : "bg-muted text-ink-soft"}`}>
                  {c}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-bold">Data source</h3>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-muted/60 p-3">
              <div>
                <p className="text-xs font-semibold">{useReal ? "Real APIs" : "Mock data"}</p>
                <p className="text-[10px] text-ink-soft">{useReal ? "Live calls billable" : "Offline-safe demo"}</p>
              </div>
              <button onClick={() => setUseReal(v => !v)}
                className={`relative h-6 w-11 rounded-full transition-all ${useReal ? "bg-emerald-500" : "bg-ink-soft/40"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-all ${useReal ? "left-5" : "left-0.5"}`} />
              </button>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-bold">Simulation speed</h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[1, 2, 5].map(s => (
                <button key={s} onClick={() => setSpeed(s)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${speed === s ? "bg-mint-grad text-emerald-900" : "bg-muted text-ink-soft"}`}>
                  {s}×
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-ink-soft">Faster speeds compress the 90s scenario timeline.</p>
          </Card>

          <Card className="bg-ink text-white">
            <h3 className="text-sm font-bold">For Judges</h3>
            <p className="mt-2 text-xs text-white/70">CIRO uses Aegis — a chain of 6 specialized agents — to ingest, classify, predict, allocate, simulate, and notify in a single pipeline. All actions are auditable in the Trace screen.</p>
            <button className="mt-3 w-full rounded-full bg-white/15 py-2 text-xs font-semibold backdrop-blur hover:bg-white/25">Open submission packet</button>
          </Card>
        </div>
      </div>
    </div>
  );
}
