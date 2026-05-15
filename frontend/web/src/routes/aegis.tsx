import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, PageHeader, Pill, MiniBar } from "@/components/aegis/AppShell";
import { agentTrace, crises } from "@/components/aegis/data";
import { Brain, Download, Filter, Wrench, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/aegis")({ component: AegisPage });

function AegisPage() {
  const [agent, setAgent] = useState<string>("all");
  const [crisis, setCrisis] = useState<string>("CRS-001");
  const filtered = agentTrace.filter(a => agent === "all" || a.agent === agent);

  return (
    <div>
      <PageHeader
        eyebrow="Screen 10"
        title="Aegis Agent Trace"
        sub="Every reasoning step from every agent — fully auditable, filterable, exportable."
        right={
          <button className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white">
            <Download size={13} /> Export trace logs
          </button>
        }
      />

      {/* Flow diagram */}
      <Card className="mb-5 overflow-x-auto">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Agent chain · {crisis}</p>
        <div className="mt-4 flex min-w-max items-center gap-2">
          {agentTrace.map((a, i) => (
            <div key={a.agent} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-grad shadow-soft">
                  <Brain size={18} className="text-emerald-800" />
                </div>
                <span className="text-[10px] font-semibold">{a.agent.split(" ")[0]}</span>
                <span className="text-[9px] text-ink-soft">{a.confidence}%</span>
              </div>
              {i < agentTrace.length - 1 && <ArrowRight size={14} className="text-ink-soft" />}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
        <div className="space-y-4">
          <Card>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <Filter size={12} /> Filter by agent
            </p>
            <div className="mt-3 space-y-1">
              <button onClick={() => setAgent("all")}
                className={`block w-full rounded-xl px-3 py-1.5 text-left text-xs ${agent === "all" ? "bg-ink text-white" : "hover:bg-muted text-ink-soft"}`}>
                All agents
              </button>
              {agentTrace.map(a => (
                <button key={a.agent} onClick={() => setAgent(a.agent)}
                  className={`block w-full rounded-xl px-3 py-1.5 text-left text-xs ${agent === a.agent ? "bg-ink text-white" : "hover:bg-muted text-ink-soft"}`}>
                  {a.agent}
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Filter by crisis</p>
            <select value={crisis} onChange={e => setCrisis(e.target.value)}
              className="mt-3 w-full rounded-xl border border-border/60 bg-white px-3 py-2 text-xs">
              {crises.map(c => <option key={c.id} value={c.id}>{c.id} — {c.type}</option>)}
            </select>
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Run summary</p>
            <div className="mt-3 space-y-2 text-xs">
              <Row k="Total steps" v={`${agentTrace.length}`} />
              <Row k="Total time" v={`${agentTrace.reduce((a, x) => a + x.ms, 0)} ms`} />
              <Row k="Tools called" v={`${agentTrace.reduce((a, x) => a + x.tools.length, 0)}`} />
              <Row k="Errors recovered" v="1" />
              <Row k="Avg confidence" v={`${Math.round(agentTrace.reduce((a, x) => a + x.confidence, 0) / agentTrace.length)}%`} />
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          {filtered.map((a, i) => (
            <Card key={i}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-mint-grad">
                  <Brain size={16} className="text-emerald-800" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold">{a.agent}</h3>
                    <Pill tone="mint"><CheckCircle2 size={10} /> {a.confidence}%</Pill>
                    <Pill tone="sky">{a.ms} ms</Pill>
                    <span className="text-[10px] text-ink-soft">step {i + 1}</span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Field label="Input" body={a.input} />
                    <Field label="Reasoning" body={a.reasoning} highlight />
                    <Field label="Output" body={a.output} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Tools</span>
                    {a.tools.map(t => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[var(--teal-soft)] px-2 py-0.5 text-[10px] font-mono text-teal-800">
                        <Wrench size={9} /> {t}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-ink-soft"><span>Confidence</span><span>{a.confidence}%</span></div>
                    <MiniBar value={a.confidence} color="bg-emerald-400" />
                  </div>
                </div>
              </div>
            </Card>
          ))}

          <Card className="border-amber-200 bg-amber-50">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 text-amber-700" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Error recovered · Resource Allocator</p>
                <p className="mt-1 text-xs text-amber-800">
                  Tool call <code className="rounded bg-white px-1">tradeoff()</code> timed out at 4500ms (limit 4000ms).
                  Retried with reduced search depth (12→6). Succeeded in 610ms with confidence 90%. Logged for tuning.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, body, highlight }: { label: string; body: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${highlight ? "bg-mint/30" : "bg-muted/50"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">{label}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink">{body}</p>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between"><span className="text-ink-soft">{k}</span><span className="font-semibold tabular-nums">{v}</span></div>
  );
}
