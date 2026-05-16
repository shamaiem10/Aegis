import { useCallback, useEffect, useState } from "react";

import { ActionPlanLayout } from "../components/aegis/ActionPlanLayout";
import type { ActionPlanResult } from "../api/agentTypes";
import { fetchActionPlanForSignal } from "../api/agents";
import { listSignals } from "../api/client";
import { AgentServiceError } from "../utils/agentErrors";
import type { RootStackParamList } from "../navigation/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

type Props = NativeStackScreenProps<RootStackParamList, "ActionPlan">;

export function ActionPlanScreen({ route }: Props) {
  const { signalId, crisisId } = route.params ?? {};
  const [plan, setPlan] = useState<ActionPlanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorHint(null);
    try {
      const resolvedId = signalId ?? (crisisId?.startsWith("pk-") ? crisisId.slice(3) : crisisId);
      if (!resolvedId) {
        setPlan(null);
        return;
      }
      const all = await listSignals();
      const signal = all.find((s) => s.id === resolvedId);
      if (!signal) {
        setPlan(null);
        return;
      }
      const result = await fetchActionPlanForSignal(signal);
      setPlan(result);
    } catch (e) {
      setPlan(null);
      if (e instanceof AgentServiceError) {
        setError(e.message);
        setErrorHint(e.hint);
      } else {
        setError((e as Error).message ?? "Action plan failed");
      }
    } finally {
      setLoading(false);
    }
  }, [signalId, crisisId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ActionPlanLayout
      plan={plan}
      loading={loading}
      error={error}
      errorHint={errorHint}
      onRetry={() => void load()}
    />
  );
}
