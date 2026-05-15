import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader, Pill } from "@/components/aegis/AppShell";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

export const Route = createFileRoute("/recovery")({ component: RecoveryPage });

const steps = [
  { t: "10:09", title: "Signal received", body: "@xyz123 posts: 'Massive fire at Centaurus mall'", tone: "sky" },
  { t: "10:10", title: "Low confidence flagged", body: "Single source · velocity rising · no sensor / weather corroboration", tone: "amber" },
  { t: "10:11", title: "Verification triggered", body: "Aegis queries 4 nearby sensors + traffic cams + 112 call log", tone: "amber" },
  { t: "10:13", title: "Confirmed FALSE", body: "0 sensor anomalies · cams clear · 0 emergency calls. Source has 2 prior false posts.", tone: "alert" },
  { t: "10:14", title: "Internal alert retracted", body: "Pre-alert to ICT Fire withdrawn before dispatch", tone: "amber" },
  { t: "10:15", title: "Public correction sent", body: "Bilingual apology dispatched to 12,400 recipients who saw the viral repost", tone: "mint" },
  { t: "10:15", title: "Log updated", body: "Source @xyz123 added to credibility downgrade list (priority -40 for 24h)", tone: "mint" },
];

const history = [
  { id: "FALSE-09", time: "10:15 today", title: "Centaurus 'fire' false alarm", impact: "0 dispatched · 12.4k corrected", tone: "alert" },
  { id: "FALSE-08", time: "Yesterday 18:42", title: "G-9 'gas leak' over-amplified", impact: "1 unit recalled · 4.2k corrected", tone: "amber" },
  { id: "FALSE-07", time: "Mon 11:08", title: "Heatwave duplicate of CRS-002", impact: "Merged silently · no public message", tone: "sky" },
];

function RecoveryPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Screen 09"
        title="False Alarm & Recovery"
        sub="How Aegis handles wrong detections — verification, retraction, apology, and learning."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Active scenario · FALSE-09</h3>
            <Pill tone="alert">FALSE ALARM CONFIRMED</Pill>
          </div>

          <ol className="mt-5 relative border-l-2 border-border/60 pl-6">
            {steps.map((s, i) => {
              const Icon = s.tone === "mint" ? CheckCircle2 : s.tone === "alert" ? X : AlertTriangle;
              const ringColor = s.tone === "mint" ? "bg-emerald-500" :
                                s.tone === "alert" ? "bg-alert" :
                                s.tone === "amber" ? "bg-amber-400" : "bg-sky-500";
              return (
                <li key={i} className="mb-5 last:mb-0">
                  <span className={`absolute -left-[10px] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background ${ringColor}`}>
                    <Icon size={11} className="text-white" />
                  </span>
                  <p className="font-mono text-[11px] text-ink-soft">{s.t}</p>
                  <p className="text-sm font-semibold text-ink">{s.title}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">{s.body}</p>
                </li>
              );
            })}
          </ol>

          <div className="mt-5 rounded-2xl bg-mint/40 p-4">
            <p className="text-xs font-semibold text-emerald-900">Apology dispatched</p>
            <p className="mt-1 text-xs leading-relaxed text-ink">
              "We apologize for the earlier alert regarding Centaurus mall. After verification, the report was found to be a false alarm.
              No fire occurred. CIRO is reviewing source credibility to prevent recurrence."
            </p>
            <p className="mt-2 text-[10px] text-ink-soft">Sent in English + Urdu · Delivered 12,400 / 12,400</p>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-bold">Correction history</h3>
            <div className="mt-3 space-y-2">
              {history.map(h => (
                <div key={h.id} className="rounded-2xl border border-border/60 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-ink-soft">{h.id}</span>
                    <Pill tone={h.tone as any}>resolved</Pill>
                  </div>
                  <p className="mt-1 text-sm font-semibold">{h.title}</p>
                  <p className="text-[11px] text-ink-soft">{h.impact}</p>
                  <p className="mt-1 text-[10px] text-ink-soft">{h.time}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-bold">Trust metrics</h3>
            <div className="mt-3 space-y-2 text-xs">
              <Row k="False alarm rate" v="2.1%" />
              <Row k="Avg time to retract" v="3.4 min" />
              <Row k="Public trust score" v="87 / 100" />
              <Row k="Source downgrades (24h)" v="3" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
      <span className="text-ink-soft">{k}</span>
      <span className="font-semibold text-ink">{v}</span>
    </div>
  );
}
