import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { crises as demoCrises, type Crisis } from "@/components/aegis/data";
import { dossiersToCrises } from "@/lib/dossier-adapter";
import { getConfiguredApiBase, listCrises } from "@/lib/aegis-api";

const qk = ["aegis-crises"];

export function useAegisDashboard() {
  const hasBase = useMemo(() => Boolean(getConfiguredApiBase()), []);

  const q = useQuery({
    queryKey: qk,
    queryFn: () => listCrises({ limit: 100 }),
    enabled: hasBase,
    staleTime: 15_000,
  });

  const crises: Crisis[] = useMemo(() => {
    if (!hasBase) return demoCrises;
    if (!q.data?.length) return demoCrises;
    return dossiersToCrises(q.data);
  }, [hasBase, q.data]);

  return {
    hasBase,
    loading: hasBase ? q.isLoading : false,
    error: q.error,
    refetch: q.refetch,
    crisesSource: (!hasBase || !q.data?.length ? "demo" : "api") as "demo" | "api",
    crises,
  };
}
