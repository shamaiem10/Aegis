import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, Droplets, Car, Thermometer, ShieldCheck, ArrowRight,
  Cloud, MessageSquare, TrafficCone, Send, Bell as BellIcon, Sparkles,
  Route, Users, FileWarning, ChevronRight, Play, CheckCircle2, TrendingDown,
  Clock, Download, Brain, Search, BarChart3, Zap,
} from "lucide-react";
import { MapCanvas } from "./MapCanvas";
import { BottomNav } from "./BottomNav";

/* ============ SCREEN 1 — DASHBOARD ============ */
export function DashboardScreen() {
  return (
    <div className="relative h-full bg-background pb-20">
      <div className="px-5 pt-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-ink-soft">Good Morning,</p>
            <h2 className="text-lg font-semibold text-ink">Response Team</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-mint px-2.5 py-1 text-[10px] font-semibold text-emerald-900">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Islamabad Stable
            </div>
            <div className="h-9 w-9 rounded-full bg-calm shadow-soft" />
          </div>
        </div>

        {/* Map card */}
        <div className="mt-4 overflow-hidden rounded-3xl shadow-soft border border-white/80" style={{ height: 200 }}>
          <div className="relative h-full">
            <MapCanvas variant="calm" showHeat={false} />
            <div className="absolute left-3 top-3 glass rounded-full px-2.5 py-1 text-[10px] font-medium text-ink">
              Live · Smart City Grid
            </div>
            <div className="absolute right-3 bottom-3 flex flex-col gap-1.5">
              <button className="h-7 w-7 rounded-lg bg-white/90 text-ink shadow-soft text-sm">+</button>
              <button className="h-7 w-7 rounded-lg bg-white/90 text-ink shadow-soft text-sm">−</button>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatCard label="Active Signals" value="142" trend="+8" icon={Activity} tint="sky" />
          <StatCard label="Crisis Probability" value="12%" trend="low" icon={AlertTriangle} tint="mint" />
          <StatCard label="Response Eff." value="94%" trend="+3%" icon={ShieldCheck} tint="teal" />
        </div>

        {/* Recent alerts */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-ink">Recent Alerts</h3>
            <button className="text-[10px] font-medium text-primary">View all</button>
          </div>
          <div className="space-y-2">
            <AlertRow icon={Droplets} title="Flood detected in G-10" time="2m" tint="alert" severity="high" />
            <AlertRow icon={Car} title="Traffic spike in Blue Area" time="14m" tint="amber" severity="med" />
            <AlertRow icon={Thermometer} title="Heat anomaly in F-8" time="32m" tint="orange" severity="low" />
          </div>
        </div>
      </div>
      <BottomNav active={0} />
    </div>
  );
}

function StatCard({ label, value, trend, icon: Icon, tint }: any) {
  const bg = { sky: "bg-sky", mint: "bg-mint", teal: "bg-teal-soft" }[tint as "sky"];
  return (
    <div className="rounded-2xl bg-card p-2.5 shadow-soft border border-white">
      <div className={`mb-1.5 flex h-6 w-6 items-center justify-center rounded-lg ${bg}`}>
        <Icon size={12} className="text-ink" />
      </div>
      <p className="text-[9px] text-ink-soft leading-tight">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-base font-bold text-ink">{value}</span>
        <span className="text-[9px] font-medium text-emerald-600">{trend}</span>
      </div>
    </div>
  );
}

function AlertRow({ icon: Icon, title, time, tint, severity }: any) {
  const bg = tint === "alert" ? "bg-alert/15 text-alert-deep" : tint === "amber" ? "bg-amber-100 text-amber-700" : "bg-orange-100 text-orange-700";
  const sev = severity === "high" ? "bg-alert/20 text-alert-deep" : severity === "med" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700";
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-card p-2.5 shadow-soft border border-white">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-ink truncate">{title}</p>
        <p className="text-[10px] text-ink-soft">{time} ago · auto-detected</p>
      </div>
      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${sev} uppercase`}>{severity}</span>
    </div>
  );
}

/* ============ SCREEN 2 — CRISIS ALERT ============ */
export function CrisisAlertScreen() {
  return (
    <div className="relative h-full overflow-hidden">
      {/* Blurred map background */}
      <div className="absolute inset-0">
        <MapCanvas variant="alert" />
        <div className="absolute inset-0 backdrop-blur-md bg-white/30" />
      </div>

      <div className="relative h-full overflow-y-auto scrollbar-hide px-5 pt-3 pb-6">
        <div className="flex items-center justify-between">
          <button className="h-8 w-8 rounded-full glass flex items-center justify-center shadow-soft">
            <ChevronRight size={16} className="rotate-180 text-ink" />
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-alert-deep">Critical Alert</span>
          <button className="h-8 w-8 rounded-full glass flex items-center justify-center shadow-soft">
            <BellIcon size={14} className="text-ink" />
          </button>
        </div>

        {/* Main alert card */}
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mt-4 rounded-3xl bg-card p-4 shadow-alert border border-alert/20"
        >
          <div className="flex items-start gap-3">
            <div className="relative">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-alert-grad shadow-alert">
                <Droplets size={20} className="text-white" />
              </div>
              <span className="absolute inset-0 rounded-2xl bg-alert opacity-30 animate-ping" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-ink leading-tight">Urban Flooding Detected</h3>
              <p className="mt-0.5 text-[11px] text-ink-soft">G-10 · Islamabad · 3 min ago</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-alert/8 p-3" style={{ background: "rgba(255,107,107,0.08)" }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Confidence</span>
              <span className="text-sm font-bold text-alert-deep">94%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white overflow-hidden">
              <motion.div
                className="h-full bg-alert-grad rounded-full"
                initial={{ width: 0 }}
                animate={{ width: "94%" }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Detected From</p>
            <div className="flex flex-wrap gap-1.5">
              <SourceChip icon={MessageSquare} label="Social Media" />
              <SourceChip icon={Cloud} label="Weather API" />
              <SourceChip icon={TrafficCone} label="Traffic Data" />
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Impact Analysis</p>
            <div className="space-y-1.5">
              <ImpactRow label="Roads blocked" value="7 segments" />
              <ImpactRow label="Vehicles stranded" value="~120" />
              <ImpactRow label="Response delay risk" value="High" highlight />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button className="flex-1 rounded-2xl bg-card border border-border py-2.5 text-[12px] font-semibold text-ink flex items-center justify-center gap-1.5">
              <Search size={13} /> Analyze
            </button>
            <button className="flex-1 rounded-2xl bg-alert-grad py-2.5 text-[12px] font-semibold text-white shadow-alert flex items-center justify-center gap-1.5">
              <Sparkles size={13} /> Trigger Sim
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
function SourceChip({ icon: Icon, label }: any) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-sky px-2 py-1 text-[10px] font-medium text-ink">
      <Icon size={10} /> {label}
    </span>
  );
}
function ImpactRow({ label, value, highlight }: any) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
      <span className="text-[11px] text-ink-soft">{label}</span>
      <span className={`text-[11px] font-semibold ${highlight ? "text-alert-deep" : "text-ink"}`}>{value}</span>
    </div>
  );
}

/* ============ SCREEN 3 — MULTI-AGENT REASONING ============ */
export function AgentsScreen() {
  const agents = [
    { name: "Signal", color: "#60A5FA", x: 50, y: 18, task: "Ingesting feeds", icon: Activity },
    { name: "Analysis", color: "#34D399", x: 18, y: 48, task: "Confidence: 94%", icon: Brain },
    { name: "Planner", color: "#22D3EE", x: 82, y: 48, task: "Routing strategy", icon: Route },
    { name: "Execution", color: "#FF6B6B", x: 50, y: 78, task: "Dispatch ready", icon: Zap },
  ];
  const logs = [
    { t: "0.2s", msg: "Signal cluster detected" },
    { t: "0.8s", msg: "Cross-source correlation +12 events" },
    { t: "1.4s", msg: "Confidence increased → 94%" },
    { t: "2.1s", msg: "Generating rerouting strategy" },
    { t: "2.9s", msg: "Dispatch simulation initiated" },
  ];
  return (
    <div className="relative h-full bg-background text-ink overflow-hidden">
      <div className="px-5 pt-3 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary/80 font-semibold">Orchestration</p>
            <h2 className="text-base font-semibold">Multi-Agent Reasoning</h2>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-mint px-2 py-1 text-[10px] font-semibold text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
          </div>
        </div>
      </div>

      {/* Agent graph */}
      <div className="relative mx-3 h-[290px] rounded-3xl border border-white shadow-soft overflow-hidden"
           style={{ background: "linear-gradient(135deg, #DCEEFF 0%, #E8F5F4 50%, #D8F0D2 100%)" }}>
        <div className="absolute inset-0 opacity-[0.35]"
             style={{ backgroundImage: "linear-gradient(rgba(14,165,233,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.08) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        {/* connection lines */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="line1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#60A5FA" />
              <stop offset="1" stopColor="#34D399" />
            </linearGradient>
            <linearGradient id="line2" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#34D399" />
              <stop offset="1" stopColor="#22D3EE" />
            </linearGradient>
            <linearGradient id="line3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#22D3EE" />
              <stop offset="1" stopColor="#FF6B6B" />
            </linearGradient>
          </defs>
          {[
            { d: "M50 18 L 18 48", s: "url(#line1)" },
            { d: "M50 18 L 82 48", s: "url(#line1)" },
            { d: "M18 48 L 82 48", s: "url(#line2)" },
            { d: "M18 48 L 50 78", s: "url(#line3)" },
            { d: "M82 48 L 50 78", s: "url(#line3)" },
          ].map((l, i) => (
            <path key={i} d={l.d} stroke={l.s} strokeWidth="0.4" fill="none" strokeDasharray="1.5 1.5" className="animate-flow" opacity="0.8" />
          ))}
        </svg>

        {agents.map((a, i) => {
          const Icon = a.icon;
          return (
            <motion.div
              key={a.name}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${a.x}%`, top: `${a.y}%` }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.15, type: "spring" }}
            >
              <div className="relative">
                <span
                  className="absolute inset-0 rounded-full opacity-50 animate-ping"
                  style={{ background: a.color }}
                />
                <div
                  className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 bg-white shadow-soft"
                  style={{
                    borderColor: a.color,
                    boxShadow: `0 8px 20px -8px ${a.color}99, 0 0 0 4px ${a.color}1A`,
                  }}
                >
                  <Icon size={18} style={{ color: a.color }} />
                </div>
                <div className="mt-1.5 text-center">
                  <p className="text-[10px] font-semibold text-ink">{a.name}</p>
                  <p className="text-[8px] text-ink-soft">{a.task}</p>
                </div>
                {/* thinking dots */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="h-1 w-1 rounded-full animate-thinking"
                      style={{ background: a.color, animationDelay: `${d * 0.2}s` }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Reasoning log */}
      <div className="mx-3 mt-3 rounded-2xl bg-card p-3 shadow-soft border border-white">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider text-ink-soft font-semibold">Reasoning Log</p>
          <span className="text-[9px] text-primary font-semibold">streaming…</span>
        </div>
        <div className="space-y-1.5">
          {logs.map((l, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.3 }}
              className="flex items-start gap-2 text-[10px]"
            >
              <span className="mt-1 h-1 w-1 rounded-full bg-primary" />
              <span className="text-ink-soft tabular-nums w-7">{l.t}</span>
              <span className="text-ink flex-1">{l.msg}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============ SCREEN 4 — ACTION PLANNING ============ */
export function ActionPlanScreen() {
  const actions = [
    { icon: Route, title: "Redirect traffic to alternate routes", priority: "Critical", impact: 78, time: "2 min", tint: "alert" },
    { icon: Send, title: "Dispatch emergency unit", priority: "High", impact: 65, time: "5 min", tint: "amber" },
    { icon: Users, title: "Notify nearby users", priority: "High", impact: 54, time: "Instant", tint: "sky" },
    { icon: FileWarning, title: "Generate authority ticket", priority: "Medium", impact: 32, time: "1 min", tint: "mint" },
  ];
  return (
    <div className="relative h-full bg-background pb-20">
      <div className="px-5 pt-3">
        <div className="flex items-center justify-between">
          <button className="h-8 w-8 rounded-full bg-card shadow-soft flex items-center justify-center">
            <ChevronRight size={14} className="rotate-180 text-ink" />
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Action Plan</span>
          <div className="w-8" />
        </div>

        <div className="mt-4 rounded-3xl bg-calm p-4 shadow-soft">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/70">Recommended</p>
          <h3 className="mt-1 text-lg font-bold text-ink leading-tight">Coordinated Actions</h3>
          <p className="mt-1 text-[11px] text-ink/70">4 interventions ranked by AI impact model</p>
          <div className="mt-3 flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-ink"><Sparkles size={11} /> AI scored</span>
            <span className="flex items-center gap-1 text-ink"><Clock size={11} /> 8 min total</span>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {actions.map((a, i) => <ActionCard key={i} {...a} />)}
        </div>

        <button className="mt-4 w-full rounded-2xl py-3.5 text-[13px] font-bold text-white shadow-soft flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #0EA5E9 0%, #10B981 100%)" }}>
          <Play size={14} fill="white" /> Execute Simulation
        </button>
      </div>
      <BottomNav active={2} />
    </div>
  );
}

function ActionCard({ icon: Icon, title, priority, impact, time, tint }: any) {
  const tintMap: any = {
    alert: { bg: "bg-alert/10", text: "text-alert-deep", icon: "bg-alert/15 text-alert-deep" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", icon: "bg-amber-100 text-amber-700" },
    sky: { bg: "bg-sky/40", text: "text-sky-700", icon: "bg-sky text-sky-700" },
    mint: { bg: "bg-mint/40", text: "text-emerald-700", icon: "bg-mint text-emerald-700" },
  };
  const t = tintMap[tint];
  return (
    <div className="rounded-2xl bg-card p-3 shadow-soft border border-white">
      <div className="flex items-start gap-2.5">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${t.icon}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-ink leading-tight">{title}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${t.bg} ${t.text} uppercase`}>{priority}</span>
            <span className="text-[10px] text-ink-soft flex items-center gap-0.5"><Clock size={9} /> {time}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-ink-soft">Impact</p>
          <p className="text-sm font-bold text-emerald-600">{impact}%</p>
        </div>
      </div>
      <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                    initial={{ width: 0 }} animate={{ width: `${impact}%` }}
                    transition={{ duration: 1, ease: "easeOut" }} />
      </div>
    </div>
  );
}

/* ============ SCREEN 5 — SIMULATION EXECUTION ============ */
export function SimulationScreen() {
  const logs = [
    { icon: FileWarning, msg: "Ticket #E-203 created", time: "0:02" },
    { icon: Users, msg: "248 users notified", time: "0:08" },
    { icon: Route, msg: "Route updated · 7 segments", time: "0:15" },
    { icon: TrendingDown, msg: "Congestion reduced by 63%", time: "0:42" },
  ];
  return (
    <div className="relative h-full bg-background overflow-y-auto scrollbar-hide pb-6">
      <div className="px-5 pt-3">
        <div className="flex items-center justify-between">
          <button className="h-8 w-8 rounded-full bg-card shadow-soft flex items-center justify-center">
            <ChevronRight size={14} className="rotate-180 text-ink" />
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Simulation Live</span>
          <div className="flex items-center gap-1 rounded-full bg-mint px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> 0:42
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl overflow-hidden shadow-soft border border-white" style={{ height: 150 }}>
            <div className="relative h-full">
              <MapCanvas variant="before" showRoute={false} />
              <span className="absolute left-2 top-2 rounded-full bg-alert/90 px-2 py-0.5 text-[9px] font-semibold text-white">Before</span>
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-soft border border-white" style={{ height: 150 }}>
            <div className="relative h-full">
              <MapCanvas variant="after" showHeat={false} showRoute={true} />
              <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-semibold text-white">After</span>
            </div>
          </div>
        </div>

        {/* Progress timeline */}
        <div className="mt-4 rounded-2xl bg-card p-3 shadow-soft border border-white">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold text-ink">Execution Timeline</p>
            <span className="text-[10px] text-emerald-600 font-semibold">82% complete</span>
          </div>
          <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div className="h-full rounded-full"
                        style={{ background: "linear-gradient(90deg, #0EA5E9, #10B981)" }}
                        initial={{ width: 0 }} animate={{ width: "82%" }}
                        transition={{ duration: 2, ease: "easeOut" }} />
          </div>
          <div className="mt-2 flex justify-between text-[9px] text-ink-soft">
            <span>Detect</span><span>Plan</span><span>Dispatch</span><span>Resolve</span>
          </div>
        </div>

        {/* Live logs */}
        <div className="mt-3 rounded-2xl bg-card p-3 shadow-soft border border-white">
          <p className="mb-2 text-[11px] font-semibold text-ink flex items-center gap-1.5">
            <Activity size={12} className="text-primary" /> System Logs
          </p>
          <div className="space-y-2">
            {logs.map((l, i) => {
              const Icon = l.icon;
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.4 }}
                  className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-mint">
                    <Icon size={12} className="text-emerald-700" />
                  </div>
                  <p className="flex-1 text-[11px] text-ink">{l.msg}</p>
                  <span className="text-[10px] text-ink-soft tabular-nums">{l.time}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ SCREEN 6 — OUTCOME ANALYTICS ============ */
export function OutcomeScreen() {
  const bars = [62, 48, 35, 28, 22, 18];
  const line = [85, 72, 60, 45, 32, 28];
  return (
    <div className="relative h-full bg-background overflow-y-auto scrollbar-hide pb-20">
      <div className="px-5 pt-3">
        <div className="flex items-center justify-between">
          <button className="h-8 w-8 rounded-full bg-card shadow-soft flex items-center justify-center">
            <ChevronRight size={14} className="rotate-180 text-ink" />
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Outcome Report</span>
          <button className="h-8 w-8 rounded-full bg-card shadow-soft flex items-center justify-center">
            <Download size={13} className="text-ink" />
          </button>
        </div>

        {/* Hero metric */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mt-4 rounded-3xl p-5 text-center shadow-soft relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #BEE8C7 0%, #CBEFEF 100%)" }}
        >
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/40 blur-xl" />
          <div className="relative">
            <CheckCircle2 className="mx-auto text-emerald-600" size={28} />
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-800/80">Mission Outcome</p>
            <p className="mt-1 text-4xl font-bold text-emerald-900 tabular-nums">63%</p>
            <p className="text-[12px] font-medium text-emerald-800">Impact Reduction</p>
          </div>
        </motion.div>

        {/* Charts */}
        <div className="mt-3 rounded-2xl bg-card p-3 shadow-soft border border-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-ink">Congestion Reduction</p>
              <p className="text-[9px] text-ink-soft">last 60 minutes</p>
            </div>
            <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5">
              <TrendingDown size={10} /> -63%
            </span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-1.5 h-20">
            {bars.map((b, i) => (
              <motion.div key={i}
                initial={{ height: 0 }} animate={{ height: `${b}%` }}
                transition={{ delay: i * 0.08, duration: 0.6 }}
                className="flex-1 rounded-t-md"
                style={{ background: `linear-gradient(180deg, #FF6B6B ${100 - b}%, #34D399)` }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[8px] text-ink-soft">
            <span>0m</span><span>20m</span><span>40m</span><span>60m</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-card p-3 shadow-soft border border-white">
            <p className="text-[10px] text-ink-soft">Response Time</p>
            <p className="text-lg font-bold text-ink">4.2<span className="text-[10px] font-medium text-ink-soft">min</span></p>
            <svg viewBox="0 0 60 24" className="mt-1 h-6 w-full">
              <polyline
                points={line.map((v, i) => `${i * 12},${v / 4}`).join(" ")}
                fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round"
              />
            </svg>
            <p className="text-[9px] text-emerald-600 font-semibold">↓ 41% faster</p>
          </div>
          <div className="rounded-2xl bg-card p-3 shadow-soft border border-white">
            <p className="text-[10px] text-ink-soft">Risk Mitigation</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="relative h-10 w-10">
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="#E5F5EE" strokeWidth="3.5" />
                  <motion.circle cx="18" cy="18" r="15" fill="none" stroke="#10B981" strokeWidth="3.5"
                                 strokeLinecap="round" strokeDasharray="94.2"
                                 initial={{ strokeDashoffset: 94.2 }}
                                 animate={{ strokeDashoffset: 94.2 * 0.13 }}
                                 transition={{ duration: 1.4 }} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-ink">87</span>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-ink">Score</p>
                <p className="text-[9px] text-emerald-600">Excellent</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI insights */}
        <div className="mt-3 rounded-2xl p-3 shadow-soft border border-white"
             style={{ background: "linear-gradient(135deg, #DCEEFF 0%, #ffffff 100%)" }}>
          <div className="flex items-start gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-soft">
              <Sparkles size={13} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-ink">AI Insight</p>
              <p className="mt-1 text-[10px] leading-relaxed text-ink-soft">
                Early traffic redirection within 2 minutes of detection prevented cascade
                congestion across 3 adjacent sectors. Notification batching reduced
                bystander exposure by 41%.
              </p>
            </div>
          </div>
        </div>

        <button className="mt-3 w-full rounded-2xl bg-ink py-3 text-[12px] font-semibold text-white shadow-soft flex items-center justify-center gap-2">
          <Download size={13} /> Export Report
        </button>
      </div>
      <BottomNav active={4} />
    </div>
  );
}
