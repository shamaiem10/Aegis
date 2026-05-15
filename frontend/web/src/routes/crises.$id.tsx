import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, Pill, SeverityBar, MiniBar } from "@/components/aegis/AppShell";
import { crises as demoCrises, signals as demoSignals, type Crisis, type Signal } from "@/components/aegis/data";
import { dossierToCrisis, dossierToSignals } from "@/lib/dossier-adapter";
import { getConfiguredApiBase, getCrisis } from "@/lib/aegis-api";
import type { CrisisDossierApi } from "@/lib/aegis-types";
import { ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/crises/$id")({
  component: CrisisDetail,
});

function CrisisDetail() {
  const { id } = Route.useParams();
  const base = getConfiguredApiBase();
  const fallbackCrisis = demoCrises.find((x) => x.id === id);

  const dq = useQuery({
    queryKey: ["crisis-detail", id],
    queryFn: () => getCrisis(id),
    enabled: Boolean(base),
    retry: false,
  });

  let c: Crisis | null = null;
  let dossier: CrisisDossierApi | null = null;
  let evidence: Signal[] = [];

  if (!base) {
    if (!fallbackCrisis) throw notFound();
    c = fallbackCrisis;
    evidence = demoSignals.filter((s) => s.crisisId === id);
  } else if (dq.isPending) {
    return <div className="p-8 text-sm text-ink-soft">Loading crisis dossier…</div>;
  } else if (dq.data) {
    dossier = dq.data;
    c = dossierToCrisis(dossier);
    evidence = dossierToSignals(dossier);
  } else if (dq.isError) {
    if (!fallbackCrisis) throw notFound();
    c = fallbackCrisis;
    evidence = demoSignals.filter((s) => s.crisisId === id);
  }

  if (!c) throw notFound();

  const conflicting = evidence.filter((s) => s.contradiction > 60);

  return (
    <div>
      <Link to="/crises" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={13} /> All crises
      </Link>

      <PageHeader
        eyebrow={`Screen 04 · ${c.id}${dossier ? " · API" : ""}`}
        title={`${c.type} — ${c.location}`}
        sub={`Detected ${c.detectedAt} · Confidence ${c.confidence}%`}
        right={<Pill tone={c.status === "ACTIVE" ? "alert" : "amber"}>● {c.status}</Pill>}
      />

      {dq.isError && base && fallbackCrisis && (
        <Card className="mb-5 text-xs text-amber-900 bg-amber-50 border-amber-200">
          Backend fetch failed — showing curated demo dossier instead.
        </Card>
      )}

      {dossier && (
        <Card className="mb-5 text-xs text-ink-soft">
          <p className="font-semibold text-ink">Pipeline snapshot</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {dossier.severity.factors.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          {dossier.severity.weather_note && (
            <p className="mt-2 text-[11px]">
              Weather note:{" "}
              <span className="font-semibold text-ink">{dossier.severity.weather_note}</span>
            </p>
          )}
          <p className="mt-2 text-[11px]">
            Allocation notes:{" "}
            <span className="text-ink">{dossier.allocation.notes}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {dossier.allocation.units.map((u) => (
              <Pill key={u.resource_id} tone="mint">
                {u.name} ×{u.quantity_available}
              </Pill>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-3">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Big k="Severity" v={`${c.severity}/10`} sub={<SeverityBar value={c.severity} />} />
            <Big k="Confidence" v={`${c.confidence}%`} sub={<MiniBar value={c.confidence} />} />
            <Big k="Affected radius" v={`${c.radiusKm} km`} sub={<span className="text-[10px] text-ink-soft">fusion cues</span>} />
            <Big k="Population" v={c.population.toLocaleString()} sub={<span className="text-[10px] text-ink-soft">estimated</span>} />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="text-sm font-bold">Operational readout</h3>
          <p className="mt-1 text-xs text-ink-soft">
            Derived from dossier payloads when `/api/v1/crises/{id}` resolves.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            <Mini k="Peak impact in" v={c.peakIn} />
            <Mini k="Expected duration" v={c.duration} />
            <Mini k="Spread risk" v={c.spreadRisk} tone={c.spreadRisk === "High" ? "alert" : "amber"} />
            <Mini k="Bundles fused" v={dossier ? String(dossier.fused.length) : "—"} />
            <Mini k="Alerts drafted" v={dossier ? String(dossier.notifications.length) : "—"} />
            <Mini k="Classifier" v={dossier?.classification.category ?? c.type.toLowerCase()} />
          </div>
        </Card>

        {c.alt && (
          <Card>
            <h3 className="text-sm font-bold">Conflicting hypothesis</h3>
            <div className="mt-3 space-y-3">
              <Hyp label={c.type} pct={c.confidence} chosen />
              <Hyp label={c.alt.type} pct={c.alt.confidence} />
              <p className="rounded-2xl bg-muted/60 p-3 text-[11px] text-ink-soft">
                <span className="font-semibold text-ink">Reasoning:</span> {c.alt.reason}
              </p>
            </div>
          </Card>
        )}

        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Signal evidence</h3>
            <Pill tone="sky">{evidence.length} rows · {conflicting.length} high-contradiction</Pill>
          </div>
          <div className="mt-3 space-y-2">
            {evidence.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-3 rounded-2xl border p-3 ${
                  s.contradiction > 60 ? "border-alert/30 bg-alert/5" : "border-border/60 bg-white"
                }`}
              >
                {s.contradiction > 60 ? (
                  <AlertTriangle size={14} className="text-alert" />
                ) : (
                  <CheckCircle2 size={14} className="text-emerald-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-ink">{s.text}</p>
                  <p className="text-[10px] text-ink-soft">
                    {s.id} · {s.time}
                  </p>
                </div>
                <div className="w-16">
                  <MiniBar value={s.credibility} color={s.credibility > 70 ? "bg-emerald-400" : s.credibility > 40 ? "bg-amber-400" : "bg-alert"} />
                  <p className="mt-1 text-right text-[10px] text-ink-soft">{s.credibility}%</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {dossier?.notifications.length ? (
          <Card className="lg:col-span-3">
            <h3 className="text-sm font-bold">Notifier payloads</h3>
            <ol className="mt-4 space-y-2 text-[11px] text-ink-soft">
              {dossier.notifications.map((n, i) => (
                <li key={i} className="rounded-xl bg-muted/50 p-3">
                  <span className="font-semibold text-ink">{n.channel}</span>: {n.title} — {n.body.slice(0, 220)}
                </li>
              ))}
            </ol>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Big({ k, v, sub }: { k: string; v: string; sub?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ink-soft">{k}</p>
      <p className="mt-1 text-2xl font-bold">{v}</p>
      <div className="mt-2">{sub}</div>
    </div>
  );
}
function Mini({ k, v, tone }: { k: string; v: string; tone?: "alert" | "amber" }) {
  return (
    <div className="rounded-2xl bg-muted/50 p-3">
      <p className="text-[10px] uppercase tracking-wider text-ink-soft">{k}</p>
      <p className={`mt-1 text-sm font-bold ${tone === "alert" ? "text-[color:var(--alert-deep)]" : tone === "amber" ? "text-amber-700" : "text-ink"}`}>{v}</p>
    </div>
  );
}
function Hyp({ label, pct, chosen }: { label: string; pct: number; chosen?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${chosen ? "border-emerald-300 bg-mint/40" : "border-border/60 bg-white"}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className={`text-xs font-bold ${chosen ? "text-emerald-700" : "text-ink-soft"}`}>
          {pct}%{chosen && " ✓ chosen"}
        </span>
      </div>
      <MiniBar value={pct} color={chosen ? "bg-emerald-500" : "bg-muted-foreground/40"} />
    </div>
  );
}
