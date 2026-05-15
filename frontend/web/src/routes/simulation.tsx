import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, PageHeader, Pill, MiniBar } from "@/components/aegis/AppShell";
import { ArrowRight, Play, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/simulation")({ component: SimPage });

const actions = [
  { id: "reroute", label: "🚦 Reroute traffic via Margalla Rd",
    before: "Kashmir Hwy: 34 min", after: "Kashmir Hwy: 18 min",
    rt: ["12 min", "7 min"], cong: -42, cost: "0 units", side: "Margalla Rd +14% volume" },
  { id: "rescue", label: "🚒 Deploy Rescue Team R-3 to F-10",
    before: "Stranded: 12 households", after: "Stranded: 0 households",
    rt: ["—", "9 min"], cong: 0, cost: "1 rescue team + 1 boat", side: "Reduces R-3 standby coverage in I-9" },
  { id: "shelter", label: "🏠 Open shelter at F-9 Park gym",
    before: "Capacity: 0", after: "Capacity: 220 beds",
    rt: ["—", "20 min setup"], cong: +5, cost: "8 field staff + supplies", side: "Local parking saturated within 15 min" },
  { id: "alert", label: "📢 Send public alert (Urdu + EN)",
    before: "Public unaware", after: "47k residents notified",
    rt: ["—", "<1 min"], cong: -8, cost: "0 units", side: "Possible secondary panic calls to 112" },
  { id: "hospital", label: "🏥 Pre-notify PIMS for intake surge",
    before: "ER queue: 4", after: "ER prepped for +25",
    rt: ["—", "2 min"], cong: 0, cost: "1 coordinator", side: "Elective procedures may delay 30 min" },
  { id: "request", label: "📦 Request 4 more ambulances from Rawalpindi",
    before: "Reserve: 2", after: "Reserve: 6",
    rt: ["—", "ETA 22 min"], cong: 0, cost: "Cross-jurisdiction approval", side: "Reduces Rawalpindi reserve by 20%" },
];

function SimPage() {
  const [open, setOpen] = useState(actions[0].id);

  return (
    <div>
      <PageHeader
        eyebrow="Screen 06"
        title="Impact Simulation"
        sub="Counterfactual modeling for every candidate response action — see the predicted state before committing resources."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
        {/* Action list */}
        <div className="space-y-2">
          {actions.map(a => (
            <button key={a.id} onClick={() => setOpen(a.id)}
              className={`block w-full rounded-2xl border p-3 text-left transition-all ${
                open === a.id ? "border-ink bg-card shadow-soft" : "border-border/60 bg-white hover:bg-muted"
              }`}>
              <p className="text-sm font-semibold">{a.label}</p>
              <p className="mt-0.5 text-[10px] text-ink-soft">Sim ID SIM-{a.id.toUpperCase()}</p>
            </button>
          ))}
        </div>

        {/* Detail */}
        {actions.filter(a => a.id === open).map(a => (
          <Card key={a.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-soft">Simulation</p>
                <h3 className="mt-1 text-xl font-bold">{a.label}</h3>
              </div>
              <button className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white">
                <Play size={12} fill="currentColor" /> Re-run simulation
              </button>
            </div>

            {/* Before / After */}
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr]">
              <State label="Before state" tone="alert" body={a.before} />
              <div className="flex items-center justify-center"><ArrowRight className="text-ink-soft" /></div>
              <State label="Expected after state" tone="mint" body={a.after} />
            </div>

            {/* KPIs */}
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi k="Response time" v={`${a.rt[0]} → ${a.rt[1]}`} good />
              <Kpi k="Congestion impact" v={`${a.cong > 0 ? "+" : ""}${a.cong}%`} good={a.cong < 0} />
              <Kpi k="Resource cost" v={a.cost} />
              <Kpi k="Confidence" v="84%" sub={<MiniBar value={84} color="bg-emerald-400" />} />
            </div>

            {/* Side effects */}
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 text-amber-700" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Possible side effects</p>
                  <p className="mt-0.5 text-xs text-amber-800">{a.side}</p>
                </div>
              </div>
            </div>

            {/* Approve */}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button className="rounded-full border border-border/60 px-4 py-2 text-xs font-semibold">Discard</button>
              <button className="rounded-full bg-mint-grad px-4 py-2 text-xs font-semibold text-emerald-900">Approve & deploy</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function State({ label, tone, body }: { label: string; tone: "alert" | "mint"; body: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === "alert" ? "border-alert/30 bg-alert/5" : "border-emerald-300 bg-mint/40"}`}>
      <Pill tone={tone}>{label}</Pill>
      <p className="mt-2 text-sm font-semibold text-ink">{body}</p>
    </div>
  );
}
function Kpi({ k, v, good, sub }: { k: string; v: string; good?: boolean; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-muted/50 p-3">
      <p className="text-[10px] uppercase tracking-wider text-ink-soft">{k}</p>
      <p className={`mt-1 text-base font-bold ${good ? "text-emerald-700" : "text-ink"}`}>{v}</p>
      {sub && <div className="mt-1.5">{sub}</div>}
    </div>
  );
}
