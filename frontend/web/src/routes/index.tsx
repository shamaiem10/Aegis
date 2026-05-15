import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CityMap } from "@/components/aegis/CityMap";
import { Card, PageHeader, Pill, SeverityBar } from "@/components/aegis/AppShell";
import { type Crisis, type CrisisType } from "@/components/aegis/data";
import { Layers, Filter, X, Navigation } from "lucide-react";
import { useAegisDashboard } from "@/hooks/useAegisDashboard";

export const Route = createFileRoute("/")({ component: MapPage });

const types: CrisisType[] = ["Flood", "Heatwave", "Accident", "Infrastructure", "Power Outage", "Protest", "Disease Cluster"];

function MapPage() {
  const { crises, crisesSource, loading, error, refetch, hasBase } = useAegisDashboard();
  const [traffic, setTraffic] = useState(true);
  const [resources, setResources] = useState(true);
  const [active, setActive] = useState<CrisisType[]>([]);
  const [selected, setSelected] = useState<Crisis | null>(null);

  const toggle = (t: CrisisType) =>
    setActive(a => a.includes(t) ? a.filter(x => x !== t) : [...a, t]);

  return (
    <div>
      <PageHeader
        eyebrow="Screen 01"
        title="Live Crisis Map"
        sub="Pins reflect the FastAPI `/api/v1/crises` feed when `VITE_API_URL` / Settings base URL is configured; otherwise the built-in CIRO demo set is shown."
        right={
          <div className="flex flex-wrap items-center gap-2">
            {loading && <Pill tone="sky">Syncing API…</Pill>}
            {error && (
              <button type="button" onClick={() => refetch()} className="rounded-full bg-alert/15 px-3 py-1.5 text-xs font-semibold text-[color:var(--alert-deep)]">
                API error · retry
              </button>
            )}
            {!hasBase && <Pill tone="amber">demo data</Pill>}
            {hasBase && crisesSource === "api" && <Pill tone="mint">live API</Pill>}
            <button onClick={() => setTraffic(t => !t)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${traffic ? "bg-ink text-white" : "bg-muted text-ink-soft"}`}>
              <Layers size={13} /> Traffic {traffic ? "ON" : "OFF"}
            </button>
            <button onClick={() => setResources(r => !r)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${resources ? "bg-mint-grad text-emerald-900" : "bg-muted text-ink-soft"}`}>
              <Navigation size={13} /> Resources
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
        <div>
          <CityMap
            crisesData={crises}
            height={620}
            selectedTypes={active.length ? active : undefined}
            showTraffic={traffic}
            showResources={resources}
            highlightId={selected?.id}
            onPinClick={setSelected}
          />

          {/* Filter chips */}
          <Card className="mt-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Filter size={14} /> Filter by crisis type
              {active.length > 0 && (
                <button onClick={() => setActive([])} className="ml-auto text-[11px] text-ink-soft hover:text-ink">Clear</button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {types.map((t) => {
                const on = active.includes(t);
                return (
                  <button key={t} onClick={() => toggle(t)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all ${
                      on ? "bg-ink text-white" : "bg-muted text-ink-soft hover:bg-sky"
                    }`}>{t}</button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-4 border-t border-border/60 pt-3 text-[11px] text-ink-soft">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#E11D48]" /> Critical</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" /> High</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#EAB308]" /> Medium</span>
              <span className="ml-auto">Showing {(active.length ? active : types).length} types · {crises.length} crises</span>
            </div>
          </Card>
        </div>

        {/* Side / detail sheet */}
        <div className="space-y-4">
          {selected ? (
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <Pill tone="alert">● {selected.status}</Pill>
                  <h3 className="mt-2 text-lg font-bold">{selected.type}</h3>
                  <p className="text-xs text-ink-soft">{selected.id} · {selected.location}</p>
                </div>
                <button onClick={() => setSelected(null)} className="rounded-full p-1 hover:bg-muted">
                  <X size={16} />
                </button>
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-[11px] text-ink-soft"><span>Severity</span><span>Confidence {selected.confidence}%</span></div>
                  <SeverityBar value={selected.severity} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <Stat k="Radius" v={`${selected.radiusKm} km`} />
                  <Stat k="Population" v={selected.population.toLocaleString()} />
                  <Stat k="Peak in" v={selected.peakIn} />
                  <Stat k="Spread risk" v={selected.spreadRisk} />
                </div>
                <a href={`/crises/${selected.id}`} className="mt-2 block rounded-2xl bg-ink py-2.5 text-center text-xs font-semibold text-white">
                  Open full detail →
                </a>
              </div>
            </Card>
          ) : (
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Active Crises</p>
              <div className="mt-3 space-y-2">
                {crises.slice(0, 5).map(c => (
                  <button key={c.id} onClick={() => setSelected(c)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-white p-3 text-left transition-all hover:shadow-soft">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold text-white"
                          style={{ background: c.severity >= 8 ? "#E11D48" : c.severity >= 5 ? "#F59E0B" : "#EAB308" }}>
                      {c.severity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{c.type}</p>
                      <p className="truncate text-[10px] text-ink-soft">{c.location}</p>
                    </div>
                    <Pill tone={c.status === "ACTIVE" ? "alert" : "amber"}>{c.confidence}%</Pill>
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Live resources on map</p>
            <div className="mt-3 space-y-2 text-xs">
              <Row dot="#10B981" label="Ambulance unit AMB-04" sub="En route to CRS-001 · ETA 6 min" />
              <Row dot="#0EA5E9" label="Police patrol PP-12" sub="Sweeping perimeter CRS-005" />
              <Row dot="#A855F7" label="Drone DRN-2" sub="Aerial scan CRS-001" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-ink-soft">{k}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{v}</p>
    </div>
  );
}
function Row({ dot, label, sub }: { dot: string; label: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot, boxShadow: `0 0 0 4px ${dot}33` }} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{label}</p>
        <p className="truncate text-[10px] text-ink-soft">{sub}</p>
      </div>
    </div>
  );
}
