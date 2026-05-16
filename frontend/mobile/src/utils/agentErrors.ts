/** User-facing errors when live agents are required (no offline/rule fallback). */

export const AGENT_SETUP_HINT =
  "1) cloud-run: .\\scripts\\restart-dev.ps1 (port 8080)\n" +
  "2) mobile .env: EXPO_PUBLIC_API_URL=http://YOUR_WIFI_IP:8080 then expo start -c\n" +
  "3) cloud-run/.env: GEMINI_API_KEY=your_key (GEMINI_VERTEX_MODEL=gemini-2.0-flash)";

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
  if (lower.includes("404") || lower.includes("not found") || lower.includes("network")) {
    const portHint =
      apiBase?.includes(":8000") ?
        "Backend URL points to FastAPI (:8000). Agent APIs live on cloud-run (:8080)."
      : "Cannot reach agent API. Is cloud-run running on port 8080?";
    return new AgentServiceError(portHint, AGENT_SETUP_HINT);
  }
  if (lower.includes("degraded") || lower.includes("rule-based") || lower.includes("fallback")) {
    return new AgentServiceError(
      "Agents did not run on Vertex/Gemini (degraded mode disabled).",
      AGENT_SETUP_HINT,
    );
  }
  return new AgentServiceError(raw || "Agent request failed", AGENT_SETUP_HINT);
}
