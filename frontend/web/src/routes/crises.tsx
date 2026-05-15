import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, PageHeader, Pill, SeverityBar } from "@/components/aegis/AppShell";
import { crises as demoCrises } from "@/components/aegis/data";
import { dossiersToCrises } from "@/lib/dossier-adapter";
import { getConfiguredApiBase, listCrises, runPipeline } from "@/lib/aegis-api";
import { ChevronRight, MapPin, Clock, Cpu } from "lucide-react";

export const Route = createFileRoute("/crises")({ component: CrisesPage });

function CrisesPage() {
  const qc = useQueryClient();
  const base = getConfiguredApiBase();

  const { data: dossiers, isLoading } = useQuery({
    queryKey: ["aegis-crises"],
    queryFn: () => listCrises({ limit: 100 }),
    enabled: !!base,
  });

  const uiCrises =
    base && dossiers?.length ? dossiersToCrises(dossiers) : demoCrises;

  const ingest = useMutation({
    mutationFn: () =>
      runPipeline({ include_weather: true, use_llm_classifier: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aegis-crises"] }),
  });

  const activeCt = uiCrises.filter(c => c.status === "ACTIVE").length;
  const monCt = uiCrises.filter(c => c.status === "MONITORING").length;

  return (
    <div>
      <PageHeader
        eyebrow="Screen 03"
        title="Crisis Detection & Classification"
        sub="Powered by `/api/v1/pipeline/run` fusion → classifier → severity → allocator. Configure API base URL on Settings when your backend is up."
        right={
          base ? (
            <button
              type="button"
              disabled={ingest.isPending}
              onClick={() => ingest.mutate()}
              className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Cpu size={14} /> {ingest.isPending ? "Running…" : "Run fusion pipeline"}
            </button>
          ) : (
            <Pill tone="amber">set API URL</Pill>
          )
        }
      />

      {ingest.isError && (
        <Card className="mb-5 border-alert/40 bg-alert/5 text-sm text-[color:var(--alert-deep)]">
          {(ingest.error as Error)?.message ?? "pipeline failed"}
        </Card>
      )}

      {!!base && isLoading && (
        <p className="mb-5 text-xs text-ink-soft">Loading crises…</p>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ["Active", activeCt, "alert"],
            ["Monitoring", monCt, "amber"],
            ["Resolved (24h)", 4, "mint"],
            ["False Alarms", 2, "sky"],
          ] as const
        ).map(([l, v, t]) => (
          <Card key={l}>
            <p className="text-[10px] uppercase tracking-wider text-ink-soft">{l}</p>
            <div className="mt-1 flex items-end justify-between">
              <p className="text-3xl font-bold">{v}</p>
              <Pill tone={t}>{`● ${!base ? "demo" : "live"}`}</Pill>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {uiCrises.map((c) => (
          <Link
            key={c.id}
            to="/crises/$id"
            params={{ id: c.id }}
            className="group block rounded-3xl border border-white bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-float"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] tracking-wider text-ink-soft">{c.id}</p>
                <h3 className="mt-1 text-lg font-bold">{c.type}</h3>
              </div>
              <Pill tone={c.status === "ACTIVE" ? "alert" : c.status === "MONITORING" ? "amber" : "mint"}>
                ● {c.status}
              </Pill>
            </div>

            <div className="mt-3 space-y-2 text-[11px] text-ink-soft">
              <p className="flex items-center gap-1.5">
                <MapPin size={11} /> {c.location}{" "}
                <span className="opacity-60">
                  ({c.coords[0]}, {c.coords[1]})
                </span>
              </p>
              <p className="flex items-center gap-1.5">
                <Clock size={11} /> Detected {c.detectedAt}
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <div>
                <div className="mb-1 flex justify-between text-[10px] text-ink-soft">
                  <span>Severity</span>
                  <span>Confidence {c.confidence}%</span>
                </div>
                <SeverityBar value={c.severity} />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-[11px]">
              <span className="text-ink-soft">
                {c.population.toLocaleString()} affected · {c.radiusKm} km radius
              </span>
              <span className="flex items-center gap-1 font-semibold text-primary transition-all group-hover:gap-2">
                Open <ChevronRight size={13} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
