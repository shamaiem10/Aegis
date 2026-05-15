import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, PageHeader, Pill, MiniBar } from "@/components/aegis/AppShell";
import { signals, type SignalSource } from "@/components/aegis/data";
import { Globe, Cloud, Car, Radio as Sensor, Phone, Search } from "lucide-react";

export const Route = createFileRoute("/signals")({ component: SignalsPage });

const sourceMeta: Record<SignalSource, { icon: typeof Globe; label: string; tone: string }> = {
  social:  { icon: Globe, label: "Social", tone: "bg-sky text-sky-800" },
  weather: { icon: Cloud, label: "Weather", tone: "bg-[var(--teal-soft)] text-teal-800" },
  traffic: { icon: Car, label: "Traffic", tone: "bg-amber-100 text-amber-800" },
  sensor:  { icon: Sensor, label: "Sensor", tone: "bg-mint text-emerald-800" },
  call:    { icon: Phone, label: "112 Call", tone: "bg-alert/15 text-[color:var(--alert-deep)]" },
};

const badgeTone = (b: string) =>
  b === "VERIFIED" ? "mint" : b === "LOW CONFIDENCE" ? "amber" : b === "SUSPICIOUS" ? "alert" : "alert";

function SignalsPage() {
  const [src, setSrc] = useState<SignalSource | "all">("all");
  const [thresh, setThresh] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const filtered = signals.filter(s => (src === "all" || s.source === src) && s.credibility >= thresh);

  return (
    <div>
      <PageHeader
        eyebrow="Screen 02"
        title="Signal Feed"
        sub="Real-time stream of every raw signal entering Aegis. Each event is scored for credibility, geo, urgency, velocity, and contradiction."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
        {/* Filters */}
        <div className="space-y-4">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Source type</p>
            <div className="mt-3 space-y-1">
              {(["all", "social", "weather", "traffic", "sensor", "call"] as const).map(s => (
                <button key={s} onClick={() => setSrc(s)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium ${src === s ? "bg-ink text-white" : "hover:bg-muted text-ink-soft"}`}>
                  <span className="capitalize">{s === "all" ? "All sources" : sourceMeta[s as SignalSource].label}</span>
                  <span className="text-[10px] opacity-70">
                    {s === "all" ? signals.length : signals.filter(x => x.source === s).length}
                  </span>
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Credibility ≥ {thresh}%</p>
            <input type="range" min={0} max={100} step={5} value={thresh} onChange={e => setThresh(+e.target.value)}
              className="mt-3 w-full accent-[color:var(--primary)]" />
            <div className="mt-2 flex justify-between text-[10px] text-ink-soft"><span>0</span><span>50</span><span>100</span></div>
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Live throughput</p>
            <p className="mt-1 text-2xl font-bold text-ink">142<span className="text-xs font-medium text-ink-soft">/min</span></p>
            <MiniBar value={72} />
            <p className="mt-2 text-[10px] text-ink-soft">+8% vs last hour · 0 dropped</p>
          </Card>
        </div>

        {/* Feed */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-2.5 shadow-soft">
            <Search size={14} className="text-ink-soft" />
            <input placeholder="Search signal text, ID, or coordinates..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft" />
            <Pill tone="sky">{filtered.length} signals</Pill>
          </div>

          {filtered.map(s => {
            const meta = sourceMeta[s.source];
            const Icon = meta.icon;
            const isOpen = open === s.id;
            return (
              <Card key={s.id} className="!p-0 overflow-hidden">
                <button onClick={() => setOpen(isOpen ? null : s.id)} className="block w-full p-5 text-left">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${meta.tone}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[10px] text-ink-soft">
                        <span className="font-mono font-semibold">{s.id}</span>
                        <span>·</span><span>{meta.label}</span>
                        <span>·</span><span>{s.time}</span>
                        {s.crisisId && <><span>·</span><span className="text-primary font-semibold">→ {s.crisisId}</span></>}
                      </div>
                      <p className="mt-1.5 text-sm text-ink">{s.text}</p>
                      <div className="mt-3 grid grid-cols-5 gap-2">
                        <Score k="Cred" v={s.credibility} />
                        <Score k="Geo" v={s.geo} />
                        <Score k="Urgency" v={s.urgency} />
                        <Score k="Velocity" v={s.velocity} />
                        <Score k="Contra" v={s.contradiction} invert />
                      </div>
                    </div>
                    <Pill tone={badgeTone(s.badge) as any}>
                      {s.badge === "VERIFIED" && "✅"} {s.badge === "LOW CONFIDENCE" && "⚠️"}
                      {s.badge === "SUSPICIOUS" && "🚨"} {s.badge === "FALSE ALARM" && "❌"} {s.badge}
                    </Pill>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-border/60 bg-muted/40 px-5 py-4 text-xs">
                    <p className="font-semibold text-ink">Signal trace</p>
                    <ul className="mt-2 space-y-1 text-ink-soft">
                      <li>• Ingested via {meta.label} pipeline at {s.time}</li>
                      <li>• Geocoded with {s.geo}% confidence</li>
                      <li>• Cross-checked against {Math.floor(Math.random()*5)+3} concurrent signals</li>
                      {s.crisisId
                        ? <li>• Linked to <span className="font-semibold text-primary">{s.crisisId}</span> as supporting evidence</li>
                        : <li>• Held in candidate pool — no crisis hypothesis yet</li>}
                    </ul>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Score({ k, v, invert }: { k: string; v: number; invert?: boolean }) {
  const good = invert ? v < 30 : v > 70;
  const mid = invert ? v < 60 : v > 40;
  const color = good ? "bg-emerald-400" : mid ? "bg-amber-400" : "bg-alert";
  return (
    <div>
      <div className="flex justify-between text-[9px] text-ink-soft"><span>{k}</span><span className="font-semibold tabular-nums text-ink">{v}</span></div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className={`h-full ${color}`} style={{ width: `${v}%` }} /></div>
    </div>
  );
}
