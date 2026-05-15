import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader, Pill, MiniBar } from "@/components/aegis/AppShell";
import { resources, crises } from "@/components/aegis/data";
import { AlertTriangle, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/resources")({ component: ResourcesPage });

function ResourcesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Screen 05"
        title="Resource Allocation"
        sub="Eight resource pools, live availability, and live trade-offs across competing crises."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-5">
        {[
          ["Total assets", resources.reduce((a, r) => a + r.total, 0)],
          ["Currently deployed", resources.reduce((a, r) => a + r.deployed, 0)],
          ["Crises served", new Set(resources.flatMap(r => r.assigned?.map(a => a.crisisId) ?? [])).size],
          ["Avg ETA", "8.4 min"],
        ].map(([k, v]: any) => (
          <Card key={k}>
            <p className="text-[10px] uppercase tracking-wider text-ink-soft">{k}</p>
            <p className="mt-1 text-2xl font-bold">{v}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {resources.map(r => {
          const pct = Math.round((r.deployed / r.total) * 100);
          const low = r.total - r.deployed <= 2;
          return (
            <Card key={r.type}>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-calm text-xl">{r.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold">{r.type}</p>
                  <p className="text-[10px] text-ink-soft">{r.deployed}/{r.total} deployed</p>
                </div>
                {low && <Pill tone="alert">Low</Pill>}
              </div>
              <div className="mt-3"><MiniBar value={pct} color={pct > 80 ? "bg-alert" : pct > 50 ? "bg-amber-400" : "bg-emerald-400"} /></div>
              <div className="mt-3 space-y-1.5">
                {r.assigned?.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-ink-soft">→ {a.crisisId}</span>
                    <span className="font-semibold text-ink">{a.eta}</span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Multi-crisis trade-off */}
      <h3 className="mt-8 mb-3 text-sm font-bold uppercase tracking-wider text-ink-soft">Multi-crisis trade-off</h3>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <CrisisCol c={crises[0]} got={["3× 🚑 Ambulance", "2× 🚒 Rescue", "1× 🚁 Drone", "5× 👥 Field Team"]} priority={94} />
        <div className="flex flex-col items-center justify-center">
          <div className="rounded-2xl bg-ink px-3 py-1.5 text-[10px] font-semibold text-white">Aegis Decision</div>
          <ArrowRight className="my-2 rotate-90 lg:rotate-0 text-ink-soft" size={20} />
          <p className="max-w-[160px] text-center text-[11px] text-ink-soft">
            Severity 9 vs 6 + 48k vs 5k pop → CRS-001 wins ambulance pool.
          </p>
        </div>
        <CrisisCol c={crises[2]} got={["1× 🚑 Ambulance (deferred)", "2× 👮 Police", "Re-route active"]} priority={62} deferred />
      </div>

      {/* Constraints */}
      <Card className="mt-5 border-amber-200 bg-amber-50">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="mt-0.5 text-amber-700" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Capacity constraints</p>
            <ul className="mt-1 space-y-0.5 text-[12px] text-amber-800">
              <li>• Only 2 ambulances remaining in F-zone — escalating to G-zone reserves.</li>
              <li>• Sensor Gateway offline — manual field reports being prioritized.</li>
              <li>• 3 generators reserved for hospital UPS standby — cannot redeploy.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

function CrisisCol({ c, got, priority, deferred }: { c: any; got: string[]; priority: number; deferred?: boolean }) {
  return (
    <Card className={deferred ? "opacity-90" : "border-2 border-emerald-300"}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] text-ink-soft">{c.id}</p>
          <h4 className="text-base font-bold">{c.type}</h4>
          <p className="text-[11px] text-ink-soft">{c.location}</p>
        </div>
        <Pill tone={deferred ? "amber" : "mint"}>Priority {priority}</Pill>
      </div>
      <div className="mt-3 space-y-1.5 text-xs">
        {got.map(g => <div key={g} className="rounded-lg bg-muted/60 px-2 py-1">{g}</div>)}
      </div>
    </Card>
  );
}
