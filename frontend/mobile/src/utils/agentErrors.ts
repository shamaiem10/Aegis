/** User-facing errors when live agents are required (no offline/rule fallback). */

export const AGENT_SETUP_HINT =
  "1) cloud-run: npm run dev (port 8080)\n" +
  "2) mobile .env: EXPO_PUBLIC_API_URL=http://YOUR_WIFI_IP:8080 then expo start -c\n" +
  "3) cloud-run/.env: GROQ_API_KEY=your_key (https://console.groq.com) and LLM_PRIMARY=groq";

export class AgentServiceError extends Error {
  readonly hint: string;

  constructor(message: string, hint: string = AGENT_SETUP_HINT) {
    super(message);
    this.name = "AgentServiceError";
    this.hint = hint;
  }
}

export function formatAgentFetchError(raw: string, apiBase?: string): AgentServiceError {
  const lower = raw.toLowerCase();
  if (lower.includes("pollinations")) {
    return new AgentServiceError(
      "AI provider unavailable. Restart cloud-run with GROQ_API_KEY set (Pollinations removed).",
      AGENT_SETUP_HINT,
    );
  }
  if (lower.includes("groq") && (lower.includes("401") || lower.includes("403") || lower.includes("invalid"))) {
    return new AgentServiceError("Invalid GROQ_API_KEY — check cloud-run/.env and restart.", AGENT_SETUP_HINT);
  }
  if (
    lower.includes("404") ||
    lower.includes("not found") ||
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("network error") ||
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("abort") ||
    lower.includes("econnrefused") ||
    lower.includes("could not connect")
  ) {
    const portHint = apiBase?.includes(":8000")
      ? "Backend URL points to FastAPI (:8000). Agent APIs live on cloud-run (:8080)."
      : `Cannot reach cloud-run at ${apiBase ?? "your API URL"}. Phone must be on same Wi‑Fi/VPN as this PC.`;
    return new AgentServiceError(portHint, AGENT_SETUP_HINT);
  }
  if (lower.includes("degraded") || lower.includes("rule-based") || lower.includes("fallback")) {
    return new AgentServiceError(
      "Agents did not run on Groq/LLM (degraded mode disabled).",
      AGENT_SETUP_HINT,
    );
  }
  return new AgentServiceError(raw || "Agent request failed", AGENT_SETUP_HINT);
}
