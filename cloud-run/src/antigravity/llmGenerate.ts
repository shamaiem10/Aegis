import { GoogleAuth } from "google-auth-library";
import fetch from "node-fetch";

import { parseAgentJsonText } from "../utils/agentJsonParse";

export type LlmProvider = "gemini" | "openrouter" | "pollinations";

const GEMINI_FALLBACK_MODELS = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash-lite"];

export function geminiModelName(): string {
  const raw = process.env.GEMINI_VERTEX_MODEL?.trim() || "gemini-2.5-flash";
  return raw.replace(/^default\s+/i, "").trim() || "gemini-2.5-flash";
}

export function openRouterModelName(): string {
  return (
    process.env.OPENROUTER_MODEL?.trim() ||
    "google/gemini-2.5-flash-preview-05-20"
  );
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
  return Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 8192;
}

export function hasGeminiCredentials(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim()) || Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim());
}

export function hasOpenRouterCredentials(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

/** Provider order: env LLM_PROVIDER + LLM_PRIMARY, with sensible defaults. */
export function resolveProviderOrder(override?: LlmProvider[]): LlmProvider[] {
  if (override?.length) return override;

  const mode = (process.env.LLM_PROVIDER?.trim() || "auto").toLowerCase();
  const primary = (process.env.LLM_PRIMARY?.trim() || "gemini").toLowerCase() as LlmProvider;
  const secondary: LlmProvider = primary === "openrouter" ? "gemini" : "openrouter";

  const withKeys = (list: LlmProvider[]): LlmProvider[] => {
    const valid = list.filter((p) => (p === "gemini" ? hasGeminiCredentials() : p === "openrouter" ? hasOpenRouterCredentials() : true));
    if (!valid.includes("pollinations")) valid.push("pollinations");
    return valid;
  };

  if (mode === "gemini") return withKeys(["gemini", "openrouter"]);
  if (mode === "openrouter") return withKeys(["openrouter", "gemini"]);

  return withKeys([primary, secondary]);
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

let pollinationsQueue = Promise.resolve<string | void>("");

export async function generateViaPollinations(promptText: string): Promise<string> {
  const execute = async () => {
    let lastErr = "";
    for (let i = 0; i < 5; i++) {
      const res = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: "You are a crisis-management AI. Reply with a single valid JSON object only. No markdown, no prose.",
            },
            { role: "user", content: promptText },
          ],
          jsonMode: true,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        lastErr = `Pollinations API ${res.status}: ${txt.slice(0, 300)}`;
        if (res.status === 429) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        throw new Error(lastErr);
      }

      const text = await res.text();
      if (!text.trim()) throw new Error("Pollinations API returned empty response");
      return text;
    }
    throw new Error(lastErr || "Pollinations API failed after retries.");
  };

  const task = pollinationsQueue.then(() => execute()).catch(() => execute());
  pollinationsQueue = task.then(() => {}).catch(() => {});
  return task;
}

export async function generateRawText(provider: LlmProvider, promptText: string): Promise<string> {
  if (provider === "pollinations") return generateViaPollinations(promptText);
  if (provider === "openrouter") return generateViaOpenRouter(promptText);
  return generateViaGemini(promptText);
}

export interface GenerateAgentJsonOptions {
  providers?: LlmProvider[];
}

/**
 * Call LLM providers in order until JSON parses.
 * On invalid JSON from provider A, automatically tries provider B (e.g. OpenRouter).
 */
export async function generateAgentJson(
  promptPayload: unknown,
  options?: GenerateAgentJsonOptions,
): Promise<Record<string, unknown>> {
  const promptText = JSON.stringify(promptPayload);
  const providers = resolveProviderOrder(options?.providers);

  if (!providers.length) {
    throw new Error(
      "No LLM credentials. Set GEMINI_API_KEY and/or OPENROUTER_API_KEY in cloud-run/.env",
    );
  }

  let lastErr: Error | null = null;
  for (const provider of providers) {
    try {
      const text = await generateRawText(provider, promptText);
      const parsed = parseAgentJsonText(text);
      if (provider !== providers[0]) {
        console.log(`[llm] Recovered via ${provider} after primary failure`);
      }
      return parsed;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      console.warn(`[llm:${provider}]`, lastErr.message.slice(0, 160));
    }
  }

  throw lastErr ?? new Error("LLM request failed");
}

/** @deprecated Use generateAgentJson — kept for existing imports. */
export const generateGeminiJson = generateAgentJson;
