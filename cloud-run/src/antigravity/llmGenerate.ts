import { GoogleAuth } from "google-auth-library";
import fetch from "node-fetch";

import { parseAgentJsonText } from "../utils/agentJsonParse";

export type LlmProvider = "groq" | "gemini" | "openrouter";

/** Preferred chain for agents — never includes deprecated Pollinations. */
export function agentLlmProviders(): LlmProvider[] {
  return resolveProviderOrder(["groq", "gemini", "openrouter"]);
}

const GEMINI_FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-flash-latest",
];

const GROQ_FALLBACK_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

export function geminiModelName(): string {
  const raw = process.env.GEMINI_VERTEX_MODEL?.trim() || "gemini-2.5-flash";
  return raw.replace(/^default\s+/i, "").trim() || "gemini-2.5-flash";
}

export function groqModelName(): string {
  return process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
}

export function openRouterModelName(): string {
  return process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash-preview-05-20";
}

function groqModelsToTry(): string[] {
  const primary = groqModelName();
  return [primary, ...GROQ_FALLBACK_MODELS.filter((m) => m !== primary)];
}

function geminiModelsToTry(): string[] {
  const primary = geminiModelName();
  const rest = GEMINI_FALLBACK_MODELS.filter((m) => m !== primary);
  return [primary, ...rest];
}

export function gcpProjectId(): string {
  return (
    process.env.GCP_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    "aegis-496207"
  );
}

export function gcpRegion(): string {
  return process.env.GCP_REGION?.trim() || process.env.GOOGLE_CLOUD_REGION?.trim() || "us-central1";
}

function maxOutputTokens(): number {
  return (
    Number(process.env.LLM_MAX_OUTPUT_TOKENS) ||
    Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) ||
    4096
  );
}

function llmRequestTimeoutMs(): number {
  return Number(process.env.LLM_REQUEST_TIMEOUT_MS) || 90_000;
}

export function hasGroqCredentials(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export function hasGeminiCredentials(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim()) || Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim());
}

export function hasOpenRouterCredentials(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

function providerAvailable(p: LlmProvider): boolean {
  if (p === "groq") return hasGroqCredentials();
  if (p === "gemini") return hasGeminiCredentials();
  if (p === "openrouter") return hasOpenRouterCredentials();
  return false;
}

function defaultPrimaryProvider(): LlmProvider {
  if (hasGroqCredentials()) return "groq";
  if (hasOpenRouterCredentials()) return "openrouter";
  return "gemini";
}

/** Provider order: Groq-first when configured (fast JSON for all agents). */
export function resolveProviderOrder(override?: LlmProvider[]): LlmProvider[] {
  if (override?.length) {
    return override.filter(providerAvailable);
  }

  const mode = (process.env.LLM_PROVIDER?.trim() || "auto").toLowerCase();
  const primary = (process.env.LLM_PRIMARY?.trim()?.toLowerCase() || defaultPrimaryProvider()) as LlmProvider;

  let chain: LlmProvider[];
  if (mode === "groq") {
    chain = ["groq", "openrouter", "gemini"];
  } else if (mode === "gemini") {
    chain = ["gemini", "groq", "openrouter"];
  } else if (mode === "openrouter") {
    chain = ["openrouter", "groq", "gemini"];
  } else {
    const rest = (["groq", "openrouter", "gemini"] as LlmProvider[]).filter((p) => p !== primary);
    chain = [primary, ...rest];
  }

  return [...new Set(chain)].filter(providerAvailable);
}

/** Groq — primary fast inference (OpenAI-compatible API). */
export async function generateViaGroq(promptText: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error("GROQ_API_KEY not set in cloud-run/.env");

  let lastErr = "";
  for (const model of groqModelsToTry()) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are AEGIS Pakistan crisis-management AI. Reply with ONE valid JSON object only. No markdown fences, no commentary.",
          },
          { role: "user", content: promptText },
        ],
        response_format: { type: "json_object" },
        max_tokens: maxOutputTokens(),
        temperature: 0.15,
      }),
      signal: AbortSignal.timeout(llmRequestTimeoutMs()),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      lastErr = `${model}: ${res.status} ${txt.slice(0, 160)}`;
      if (res.status === 429 || res.status === 404) continue;
      throw new Error(`Groq ${res.status}: ${txt.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    if (data.error?.message) {
      lastErr = data.error.message;
      continue;
    }
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) {
      lastErr = `${model}: empty response`;
      continue;
    }
    if (model !== groqModelName()) {
      console.warn(`[llm:groq] fallback model ${model}`);
    }
    return text;
  }

  throw new Error(`Groq API failed. Last: ${lastErr}`);
}

async function generateViaGeminiApiKey(promptText: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY not set in cloud-run/.env");

  let lastErr = "";
  for (const model of geminiModelsToTry()) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: maxOutputTokens(),
          temperature: 0.25,
        },
      }),
      signal: AbortSignal.timeout(llmRequestTimeoutMs()),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      lastErr = `${model}: ${res.status} ${txt.slice(0, 120)}`;
      if (res.status === 429 || res.status === 404) continue;
      throw new Error(`Gemini API ${res.status}: ${txt.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text.trim()) {
      lastErr = `${model}: empty response`;
      continue;
    }
    if (model !== geminiModelName()) {
      console.warn(`[llm:gemini] fallback model ${model}`);
    }
    return text;
  }

  throw new Error(`Gemini API failed. Last: ${lastErr}`);
}

async function generateViaVertex(promptText: string): Promise<string> {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (credPath) {
    const fs = await import("fs");
    if (!fs.existsSync(credPath)) {
      throw new Error(`GOOGLE_APPLICATION_CREDENTIALS file not found: ${credPath}`);
    }
  }

  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;
  if (!token) throw new Error("No Vertex access token");

  const proj = gcpProjectId();
  const loc = gcpRegion();
  const model = geminiModelName();
  const base =
    process.env.ANTIGRAVITY_AGENT_ENDPOINT?.trim() ||
    `https://${loc}-aiplatform.googleapis.com/v1/projects/${proj}/locations/${loc}`;
  const url = `${base}/publishers/google/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: maxOutputTokens(),
        temperature: 0.25,
      },
    }),
    signal: AbortSignal.timeout(llmRequestTimeoutMs()),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Vertex ${res.status}: ${txt.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text.trim()) throw new Error("Vertex returned empty response");
  return text;
}

async function generateViaGemini(promptText: string): Promise<string> {
  if (process.env.GEMINI_API_KEY?.trim()) {
    return generateViaGeminiApiKey(promptText);
  }
  return generateViaVertex(promptText);
}

/** OpenRouter chat completions (JSON mode). */
export async function generateViaOpenRouter(promptText: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set in cloud-run/.env");

  const model = openRouterModelName();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER?.trim() || "https://aegis-crisis.app",
      "X-Title": process.env.OPENROUTER_APP_TITLE?.trim() || "AEGIS Crisis Management",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a crisis-management AI. Reply with a single valid JSON object only. No markdown, no prose.",
        },
        { role: "user", content: promptText },
      ],
      response_format: { type: "json_object" },
      max_tokens: maxOutputTokens(),
      temperature: 0.25,
    }),
    signal: AbortSignal.timeout(llmRequestTimeoutMs()),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${txt.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (data.error?.message) {
    throw new Error(`OpenRouter: ${data.error.message}`);
  }
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("OpenRouter returned empty response");
  return text;
}

export async function generateRawText(provider: LlmProvider, promptText: string): Promise<string> {
  if (provider === "groq") return generateViaGroq(promptText);
  if (provider === "openrouter") return generateViaOpenRouter(promptText);
  return generateViaGemini(promptText);
}

export interface GenerateAgentJsonOptions {
  providers?: LlmProvider[];
}

/**
 * Call LLM providers in order until JSON parses.
 * Default chain: Groq → OpenRouter → Gemini (when keys are set).
 */
export async function generateAgentJson(
  promptPayload: unknown,
  options?: GenerateAgentJsonOptions,
): Promise<Record<string, unknown>> {
  const promptText = JSON.stringify(promptPayload);
  const providers = resolveProviderOrder(options?.providers);

  if (!providers.length) {
    throw new Error(
      "No LLM credentials. Set GROQ_API_KEY (recommended), or GEMINI_API_KEY / OPENROUTER_API_KEY in cloud-run/.env",
    );
  }

  const errors: string[] = [];
  for (const provider of providers) {
    const t0 = Date.now();
    try {
      const text = await generateRawText(provider, promptText);
      const parsed = parseAgentJsonText(text);
      const ms = Date.now() - t0;
      if (provider !== providers[0]) {
        console.log(`[llm] Recovered via ${provider} in ${ms}ms`);
      } else {
        console.log(`[llm:${provider}] ok ${ms}ms`);
      }
      return parsed;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${provider}: ${msg.slice(0, 120)}`);
      console.warn(`[llm:${provider}] ${Date.now() - t0}ms —`, msg.slice(0, 160));
    }
  }

  const summary = errors.join(" | ");
  throw new Error(
    summary ||
      "LLM request failed. Set GROQ_API_KEY in cloud-run/.env and restart npm run dev.",
  );
}

/** @deprecated Use generateAgentJson — kept for existing imports. */
export const generateGeminiJson = generateAgentJson;
