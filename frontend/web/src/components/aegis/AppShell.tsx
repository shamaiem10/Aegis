import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Sparkles, Map, Radio, AlertTriangle, Boxes, FlaskConical, Megaphone, GitMerge, RotateCcw, Brain, ShieldAlert, Settings } from "lucide-react";
import type { ComponentType } from "react";

const nav: { to: string; label: string; icon: ComponentType<{ size?: number; className?: string }>; n?: string }[] = [
  { to: "/", label: "Live Crisis Map", icon: Map },
  { to: "/signals", label: "Signal Feed", icon: Radio, n: "142" },
  { to: "/crises", label: "Crisis Panel", icon: AlertTriangle, n: "6" },
  { to: "/resources", label: "Resources", icon: Boxes },
  { to: "/simulation", label: "Impact Simulation", icon: FlaskConical },
  { to: "/notifications", label: "Notifications", icon: Megaphone },
  { to: "/coordination", label: "Multi-Crisis", icon: GitMerge },
  { to: "/recovery", label: "False Alarm / Recovery", icon: RotateCcw },
  { to: "/aegis", label: "Aegis Agent Traces", icon: Brain },
  { to: "/robustness", label: "Robustness", icon: ShieldAlert },
  { to: "/settings", label: "Demo Controls", icon: Settings },
];

export function AppShell() {
  const loc = useLocation();
  return (
    <div className="flex min-h-screen w-full bg-background text-ink">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border/60 bg-white/60 backdrop-blur-xl lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-5 pt-6 pb-5">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl shadow-soft"
               style={{ background: "linear-gradient(135deg,#0EA5E9 0%,#10B981 100%)" }}>
            <Sparkles size={18} className="text-white" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-alert ring-2 ring-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-none">CIRO</h1>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-soft">Aegis Control</p>
          </div>
        </div>

        <nav className="mt-2 flex-1 overflow-y-auto px-3 pb-6">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = loc.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`mb-1 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all ${
                  active
                    ? "bg-mint-grad text-ink shadow-soft font-semibold"
                    : "text-ink-soft hover:bg-white hover:text-ink"
                }`}
              >
                <Icon size={16} className={active ? "text-emerald-700" : ""} />
                <span className="flex-1">{item.label}</span>
                {item.n && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                    active ? "bg-white/70 text-emerald-800" : "bg-sky text-sky-700"
                  }`}>{item.n}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/60 px-5 py-4">
          <div className="rounded-2xl bg-calm p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800">System</p>
            <p className="mt-1 text-xs font-semibold text-ink">All systems nominal</p>
            <p className="mt-0.5 text-[10px] text-ink-soft">5 of 6 APIs online · Aegis v2.4</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center gap-2 overflow-x-auto border-b border-border/60 bg-white/80 px-4 py-2 backdrop-blur-xl lg:hidden scrollbar-hide">
          {nav.map((item) => {
            const active = loc.pathname === item.to;
            return (
              <Link key={item.to} to={item.to}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium ${
                  active ? "bg-ink text-white" : "bg-muted text-ink-soft"
                }`}>
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="px-5 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function PageHeader({ eyebrow, title, sub, right }: { eyebrow?: string; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-white bg-card p-5 shadow-soft ${className}`}>
      {children}
    </div>
  );
}

export function Pill({ tone = "sky", children }: { tone?: "sky" | "mint" | "alert" | "amber" | "ink" | "teal"; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    sky: "bg-sky text-sky-800",
    mint: "bg-mint text-emerald-800",
    teal: "bg-[var(--teal-soft)] text-teal-800",
    alert: "bg-alert/15 text-[color:var(--alert-deep)]",
    amber: "bg-amber-100 text-amber-800",
    ink: "bg-ink text-white",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tones[tone]}`}>{children}</span>;
}

export function SeverityBar({ value }: { value: number }) {
  const color = value >= 8 ? "bg-alert" : value >= 5 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${value * 10}%` }} />
      </div>
      <span className="w-7 text-right text-[11px] font-semibold tabular-nums">{value}/10</span>
    </div>
  );
}

export function MiniBar({ value, color = "bg-primary" }: { value: number; color?: string }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}
