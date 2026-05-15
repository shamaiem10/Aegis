import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader, Pill } from "@/components/aegis/AppShell";
import { apiHealth } from "@/components/aegis/data";
import { CheckCircle2, AlertTriangle, X, Database, ShieldAlert, Repeat } from "lucide-react";

export const Route = createFileRoute("/robustness")({ component: RobustPage });

function RobustPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Screen 11"
        title="Robustness & Degraded Mode"
        sub="Live health of every dependency. Aegis stays useful even when its sources don't."
      />

      {/* Banner */}
      <Card className="mb-5 border-amber-200 bg-amber-50">
        <div className="flex items-start gap-3">
          <ShieldAlert size={20} className="mt-0.5 text-amber-700" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">DEGRADED MODE — Sensor Gateway offline</p>
            <p className="text-xs text-amber-800">
              Falling back to last known values from <span className="font-semibold">10:14</span> (4 min ago) and 112 call corroboration. Manual escalation available.
            </p>
          </div>
          <button className="rounded-full bg-amber-700 px-4 py-2 text-xs font-semibold text-white">Manual escalation</button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {apiHealth.map(api => {
          const tone = api.status === "Online" ? "mint" : api.status === "Slow" ? "amber" : "alert";
          const Icon = api.status === "Online" ? CheckCircle2 : api.status === "Slow" ? AlertTriangle : X;
          return (
            <Card key={api.name}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold">{api.name}</p>
                  <p className="mt-0.5 text-[11px] text-ink-soft">Latency · {api.latency}</p>
                </div>
                <Pill tone={tone as any}><Icon size={10} /> {api.status}</Pill>
              </div>
              <div className="mt-3 h-10 w-full">
                {/* mini sparkline */}
                <svg viewBox="0 0 120 36" className="h-full w-full">
                  <polyline
                    fill="none"
                    stroke={api.status === "Online" ? "#10B981" : api.status === "Slow" ? "#F59E0B" : "#E11D48"}
                    strokeWidth="2"
                    points={Array.from({ length: 24 }).map((_, i) => {
                      const y = api.status === "Down" && i > 18
                        ? 36
                        : 18 + Math.sin(i * 0.7 + (api.name.length % 5)) * (api.status === "Slow" ? 12 : 6);
                      return `${i * 5},${y}`;
                    }).join(" ")}
                  />
                </svg>
              </div>
              {api.status !== "Online" && (
                <p className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-[11px] text-ink">
                  {api.status === "Down"
                    ? "→ Using cached data from 4 min ago. 112 calls and weather used as fallback corroboration."
                    : "→ Reduced poll rate to 1/30s. Aegis confidence weighting -8%."}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <div className="flex items-center gap-2">
            <Database size={16} className="text-primary" />
            <h3 className="text-sm font-bold">Stale data warnings</h3>
          </div>
          <ul className="mt-3 space-y-2 text-xs">
            <Stale src="Sensor WL-F10-3" age="4 min" tone="alert" />
            <Stale src="Traffic API ITS-North" age="2 min" tone="amber" />
            <Stale src="Weather Station IS-1" age="<1 min" tone="mint" />
          </ul>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <Repeat size={16} className="text-primary" />
            <h3 className="text-sm font-bold">Duplicate detection</h3>
          </div>
          <ul className="mt-3 space-y-2 text-xs">
            <li className="rounded-xl bg-muted/60 p-2">
              <p className="font-semibold">3 duplicate flood reports merged</p>
              <p className="text-[10px] text-ink-soft">SIG-9822 / 9831 / 9844 → grouped into CRS-001</p>
            </li>
            <li className="rounded-xl bg-muted/60 p-2">
              <p className="font-semibold">2 traffic reports deduplicated</p>
              <p className="text-[10px] text-ink-soft">Geo distance &lt; 80m, time delta &lt; 90s</p>
            </li>
          </ul>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-primary" />
            <h3 className="text-sm font-bold">Rate limits</h3>
          </div>
          <ul className="mt-3 space-y-2 text-xs">
            <li className="flex items-center justify-between rounded-xl bg-muted/60 p-2">
              <span>Vertex AI</span><span className="font-semibold">412 / 600 RPM</span>
            </li>
            <li className="flex items-center justify-between rounded-xl bg-muted/60 p-2">
              <span>Twitter/X stream</span><span className="font-semibold text-amber-700">86 / 100 (warn)</span>
            </li>
            <li className="flex items-center justify-between rounded-xl bg-muted/60 p-2">
              <span>SMS gateway</span><span className="font-semibold">8.2k / 50k daily</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Stale({ src, age, tone }: { src: string; age: string; tone: "alert" | "amber" | "mint" }) {
  return (
    <li className="flex items-center justify-between rounded-xl bg-muted/60 p-2">
      <span className="font-medium">{src}</span>
      <Pill tone={tone}>{age} stale</Pill>
    </li>
  );
}
