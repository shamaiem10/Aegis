import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader, Pill, SeverityBar } from "@/components/aegis/AppShell";
import { crises, resources } from "@/components/aegis/data";
import { ArrowRight, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/coordination")({ component: CoordPage });

function CoordPage() {
  const a = crises[0]; // CRS-001 Flood
  const b = crises[1]; // CRS-002 Heatwave

  return (
    <div>
      <PageHeader
        eyebrow="Screen 08"
        title="Multi-Crisis Coordination"
        sub="Two simultaneous events. One resource pool. Aegis arbitrates, you oversee."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px_1fr]">
        <CrisisColumn c={a} pri={94} got={[
          ["🚑", "6 Ambulances"], ["🚒", "4 Rescue Teams"], ["🚁", "3 Drones"],
          ["👥", "12 Field Teams"], ["🏠", "1 Shelter (220 beds)"],
        ]} />

        {/* Shared pool */}
        <Card className="!p-4">
          <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Shared resource pool</p>
          <div className="mt-3 space-y-2">
            {resources.slice(0, 6).map(r => (
              <div key={r.type} className="rounded-xl bg-muted/60 p-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold">{r.icon} {r.type}</span>
                  <span className="text-ink-soft">{r.total - r.deployed} free / {r.total}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1">
                  <ArrowLeft size={11} className="text-emerald-600" />
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white">
                    <div className="h-full bg-emerald-400" style={{ width: "65%" }} />
                  </div>
                  <ArrowRight size={11} className="text-amber-600" />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-xl bg-ink p-2.5 text-center text-[10px] font-semibold text-white">
            Aegis Arbitration Engine v2.4
          </p>
        </Card>

        <CrisisColumn c={b} pri={68} deferred got={[
          ["💧", "8 Water Tankers"], ["👥", "5 Field Teams"], ["🏥", "2 Cooling Centers"],
        ]} />
      </div>

      {/* Trade-off panel */}
      <Card className="mt-5">
        <h3 className="text-sm font-bold">Trade-off rationale</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-300 bg-mint/40 p-4">
            <p className="text-xs font-semibold text-emerald-900">CRS-001 — Priority</p>
            <ul className="mt-2 space-y-1 text-[12px] text-ink">
              <li>• Severity 9/10 (life-threatening, water rising)</li>
              <li>• 48,200 population in radius</li>
              <li>• Time-criticality: peak in 42 min</li>
              <li>• Rescue requires immediate deployment</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold text-amber-900">CRS-002 — Deferred</p>
            <ul className="mt-2 space-y-1 text-[12px] text-ink">
              <li>• Severity 7/10 (chronic, longer window)</li>
              <li>• Resources en route within 8 min</li>
              <li>• Cooling centers self-sufficient for 4 hrs</li>
              <li>• Re-evaluation scheduled every 15 min</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Coordination timeline */}
      <Card className="mt-5">
        <h3 className="text-sm font-bold">Coordination timeline</h3>
        <ol className="mt-4 relative border-l border-border/60 pl-6">
          {[
            ["09:31", "Plan v1: split pool 60/40 → flagged: CRS-001 understaffed"],
            ["09:32", "Plan v2: shift 2 ambulances A→B → rejected by simulator"],
            ["09:33", "Plan v3 ✓ approved: prioritize CRS-001, request RWP reserves"],
            ["09:48", "Reassessment: CRS-002 stable, no rebalancing needed"],
          ].map(([t, l]) => (
            <li key={t} className="mb-3 last:mb-0">
              <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
              <p className="font-mono text-[11px] text-ink-soft">{t}</p>
              <p className="text-sm text-ink">{l}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function CrisisColumn({ c, pri, got, deferred }: { c: any; pri: number; got: [string, string][]; deferred?: boolean }) {
  return (
    <Card className={deferred ? "" : "border-2 border-emerald-300"}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] text-ink-soft">{c.id}</p>
          <h3 className="text-base font-bold">{c.type}</h3>
          <p className="text-[11px] text-ink-soft">{c.location}</p>
        </div>
        <Pill tone={deferred ? "amber" : "mint"}>Priority {pri}</Pill>
      </div>
      <div className="mt-3"><SeverityBar value={c.severity} /></div>
      <p className="mt-3 text-[11px] text-ink-soft">{c.population.toLocaleString()} affected · {c.radiusKm} km</p>
      <div className="mt-3 space-y-1.5">
        {got.map(([icon, label]) => (
          <div key={label} className="flex items-center gap-2 rounded-xl bg-muted/60 p-2 text-[11px]">
            <span className="text-base">{icon}</span><span className="font-semibold">{label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
