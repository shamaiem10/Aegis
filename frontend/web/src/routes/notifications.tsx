import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, PageHeader, Pill } from "@/components/aegis/AppShell";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/notifications")({ component: NotifPage });

const tabs = [
  { id: "public", label: "👥 Public", color: "sky" },
  { id: "emergency", label: "🚨 Emergency", color: "alert" },
  { id: "hospital", label: "🏥 Hospitals", color: "mint" },
  { id: "utility", label: "⚡ Utility", color: "amber" },
  { id: "transport", label: "🚌 Transport", color: "teal" },
  { id: "media", label: "📺 Media / Command", color: "ink" },
  { id: "retract", label: "🔄 Retractions", color: "alert" },
] as const;

const messages: Record<string, { title: string; body: string; status: string; time: string; priority: string; crisis: string }[]> = {
  public: [
    { title: "Flood Alert · F-10 Sector", body: "URGENT: Severe flooding reported in F-10 Markaz. Avoid the area. Move to higher ground. Emergency shelter open at F-9 Park.\n\nاہم اطلاع: F-10 مرکز میں شدید سیلاب۔ علاقہ سے گریز کریں۔ بلند مقام پر منتقل ہوں۔",
      status: "Delivered to 47,820 / 47,820", time: "09:33", priority: "P1", crisis: "CRS-001" },
    { title: "Heat Advisory · I-9 Industrial", body: "Heat index reaching 47°C between 1–4 PM. Outdoor workers: take 15-min shaded breaks every hour. Stay hydrated.",
      status: "Delivered to 132k", time: "10:08", priority: "P2", crisis: "CRS-002" },
  ],
  emergency: [
    { title: "Tactical Briefing · CRS-001", body: "Flood ops zone: F-10/2 to F-10/4. Water depth 1.4m peak. 12 households on rooftops. Coordinated extraction with Rescue 1122 R-3 + Drone DRN-2 overhead. Comms freq 154.265.",
      status: "Acknowledged by 6 units", time: "09:30", priority: "P1", crisis: "CRS-001" },
  ],
  hospital: [
    { title: "Intake Surge Warning · PIMS", body: "Expect +25 ER admissions over next 90 min. Profile: water aspiration, lacerations, mild hypothermia. Pre-stage 4 trauma bays.",
      status: "Acknowledged · ER Director", time: "09:32", priority: "P1", crisis: "CRS-001" },
    { title: "Heat Stress Watch · Polyclinic", body: "Anticipate 40-60 heat exhaustion cases over next 6 hrs from I-9 area.",
      status: "Acknowledged", time: "10:10", priority: "P2", crisis: "CRS-002" },
  ],
  utility: [
    { title: "Grid Isolation Request · IESCO", body: "Isolate feeder F10-A to prevent submerged transformer hazard. Restore G11-A feeder priority — outage affecting 22k.",
      status: "Acknowledged · 1 failed", time: "09:34", priority: "P1", crisis: "CRS-001" },
  ],
  transport: [
    { title: "Route Diversion Notice", body: "Close Kashmir Hwy onramp at Faizabad NB. Divert via Margalla Rd. Estimated +6 min cross-city.",
      status: "Live · 3 routes updated", time: "09:35", priority: "P2", crisis: "CRS-001" },
  ],
  media: [
    { title: "Press Release · Flood Response", body: "At 09:24 local time, the CIRO platform detected a flooding event in F-10 Markaz, Islamabad. The District Administration has activated emergency protocols. Rescue 1122, ICT Police, and PIMS hospital are coordinating response. Residents are advised to follow official channels.",
      status: "Sent to 14 outlets", time: "09:40", priority: "P1", crisis: "CRS-001" },
  ],
  retract: [
    { title: "RETRACTION · Earlier 'Centaurus Fire' Alert", body: "We are issuing a correction. Initial signal indicating a fire at Centaurus mall has been verified as a FALSE ALARM. There is no fire. We apologize for any confusion. Source signal flagged as misinformation.\n\nاصلاحی پیغام: سینٹورس مال میں آگ کی اطلاع غلط نکلی۔ معذرت خواہ ہیں۔",
      status: "Delivered to 12,400", time: "10:15", priority: "P1", crisis: "FALSE-09" },
  ],
};

function NotifPage() {
  const [tab, setTab] = useState<string>("public");
  const list = messages[tab] ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Screen 07"
        title="Stakeholder Notifications"
        sub="Six audiences, one orchestrator — every alert tailored, translated, and tracked end-to-end."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
              tab === t.id ? "bg-ink text-white" : "bg-card text-ink-soft hover:bg-muted"
            }`}>{t.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {list.map((m, i) => (
          <Card key={i}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-[280px]">
                <div className="flex items-center gap-2">
                  <Pill tone="alert">{m.priority}</Pill>
                  <Pill tone="sky">{m.crisis}</Pill>
                  <span className="text-[10px] text-ink-soft">{m.time}</span>
                </div>
                <h3 className="mt-2 text-sm font-bold">{m.title}</h3>
                <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-ink-soft">{m.body}</p>
              </div>
              <div className="w-full md:w-56 space-y-2">
                <div className="rounded-2xl bg-mint/40 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800">
                    <CheckCircle2 size={12} /> {m.status}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                  <Clock size={12} /> Sent {m.time} · synced
                </div>
                <button className="w-full rounded-full border border-border/60 py-1.5 text-[11px] font-semibold">Open thread</button>
              </div>
            </div>
          </Card>
        ))}

        {tab === "retract" && (
          <Card className="border-alert/30 bg-alert/5">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 text-[color:var(--alert-deep)]" />
              <div>
                <p className="text-sm font-semibold text-[color:var(--alert-deep)]">Retraction policy</p>
                <p className="mt-1 text-xs text-ink-soft">Every false alarm triggers an automatic apology message to the original recipient set, plus a log entry. Public-facing retractions are bilingual.</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
