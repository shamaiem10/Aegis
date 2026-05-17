"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateGeminiJson = void 0;
exports.agentLlmProviders = agentLlmProviders;
exports.geminiModelName = geminiModelName;
exports.groqModelName = groqModelName;
exports.openRouterModelName = openRouterModelName;
exports.gcpProjectId = gcpProjectId;
exports.gcpRegion = gcpRegion;
exports.hasGroqCredentials = hasGroqCredentials;
exports.hasGeminiCredentials = hasGeminiCredentials;
exports.hasOpenRouterCredentials = hasOpenRouterCredentials;
exports.resolveProviderOrder = resolveProviderOrder;
exports.generateViaGroq = generateViaGroq;
exports.generateViaOpenRouter = generateViaOpenRouter;
exports.generateRawText = generateRawText;
exports.generateAgentJson = generateAgentJson;
const google_auth_library_1 = require("google-auth-library");
const node_fetch_1 = __importDefault(require("node-fetch"));
const agentJsonParse_1 = require("../utils/agentJsonParse");
/** Preferred chain for agents — never includes deprecated Pollinations. */
function agentLlmProviders() {
    return resolveProviderOrder(["groq", "gemini", "openrouter"]);
}
const GEMINI_FALLBACK_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-flash-latest",
];
const GROQ_FALLBACK_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
function geminiModelName() {
    const raw = process.env.GEMINI_VERTEX_MODEL?.trim() || "gemini-2.5-flash";
    return raw.replace(/^default\s+/i, "").trim() || "gemini-2.5-flash";
}
function groqModelName() {
    return process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
}
function openRouterModelName() {
    return process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash-preview-05-20";
}
function groqModelsToTry() {
    const primary = groqModelName();
    return [primary, ...GROQ_FALLBACK_MODELS.filter((m) => m !== primary)];
}
function geminiModelsToTry() {
    const primary = geminiModelName();
    const rest = GEMINI_FALLBACK_MODELS.filter((m) => m !== primary);
    return [primary, ...rest];
}
function gcpProjectId() {
    return (process.env.GCP_PROJECT_ID?.trim() ||
        process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
        "aegis-496207");
}
function gcpRegion() {
    return process.env.GCP_REGION?.trim() || process.env.GOOGLE_CLOUD_REGION?.trim() || "us-central1";
}
function maxOutputTokens() {
    return (Number(process.env.LLM_MAX_OUTPUT_TOKENS) ||
        Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) ||
        4096);
}
function llmRequestTimeoutMs() {
    return Number(process.env.LLM_REQUEST_TIMEOUT_MS) || 90_000;
}
function hasGroqCredentials() {
    return Boolean(process.env.GROQ_API_KEY?.trim());
}
function hasGeminiCredentials() {
    return Boolean(process.env.GEMINI_API_KEY?.trim()) || Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim());
}
function hasOpenRouterCredentials() {
    return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}
function providerAvailable(p) {
    if (p === "groq")
        return hasGroqCredentials();
    if (p === "gemini")
        return hasGeminiCredentials();
    if (p === "openrouter")
        return hasOpenRouterCredentials();
    return false;
}
function defaultPrimaryProvider() {
    if (hasGroqCredentials())
        return "groq";
    if (hasOpenRouterCredentials())
        return "openrouter";
    return "gemini";
}
/** Provider order: Groq-first when configured (fast JSON for all agents). */
function resolveProviderOrder(override) {
    if (override?.length) {
        return override.filter(providerAvailable);
    }
    const mode = (process.env.LLM_PROVIDER?.trim() || "auto").toLowerCase();
    const primary = (process.env.LLM_PRIMARY?.trim()?.toLowerCase() || defaultPrimaryProvider());
    let chain;
    if (mode === "groq") {
        chain = ["groq", "openrouter", "gemini"];
    }
    else if (mode === "gemini") {
        chain = ["gemini", "groq", "openrouter"];
    }
    else if (mode === "openrouter") {
        chain = ["openrouter", "groq", "gemini"];
    }
    else {
        const rest = ["groq", "openrouter", "gemini"].filter((p) => p !== primary);
        chain = [primary, ...rest];
    }
    return [...new Set(chain)].filter(providerAvailable);
}
/** Groq — primary fast inference (OpenAI-compatible API). */
async function generateViaGroq(promptText) {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey)
        throw new Error("GROQ_API_KEY not set in cloud-run/.env");
    let lastErr = "";
    for (const model of groqModelsToTry()) {
        const res = await (0, node_fetch_1.default)("https://api.groq.com/openai/v1/chat/completions", {
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
                        content: "You are AEGIS Pakistan crisis-management AI. Reply with ONE valid JSON object only. No markdown fences, no commentary.",
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
            if (res.status === 429 || res.status === 404)
                continue;
            throw new Error(`Groq ${res.status}: ${txt.slice(0, 300)}`);
        }
        const data = (await res.json());
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
async function generateViaGeminiApiKey(promptText) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey)
        throw new Error("GEMINI_API_KEY not set in cloud-run/.env");
    let lastErr = "";
    for (const model of geminiModelsToTry()) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await (0, node_fetch_1.default)(url, {
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
            if (res.status === 429 || res.status === 404)
                continue;
            throw new Error(`Gemini API ${res.status}: ${txt.slice(0, 300)}`);
        }
        const data = (await res.json());
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
async function generateViaVertex(promptText) {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
    if (credPath) {
        const fs = await Promise.resolve().then(() => __importStar(require("fs")));
        if (!fs.existsSync(credPath)) {
            throw new Error(`GOOGLE_APPLICATION_CREDENTIALS file not found: ${credPath}`);
        }
    }
    const auth = new google_auth_library_1.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;
    if (!token)
        throw new Error("No Vertex access token");
    const proj = gcpProjectId();
    const loc = gcpRegion();
    const model = geminiModelName();
    const base = process.env.ANTIGRAVITY_AGENT_ENDPOINT?.trim() ||
        `https://${loc}-aiplatform.googleapis.com/v1/projects/${proj}/locations/${loc}`;
    const url = `${base}/publishers/google/models/${model}:generateContent`;
    const res = await (0, node_fetch_1.default)(url, {
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
    const data = (await res.json());
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text.trim())
        throw new Error("Vertex returned empty response");
    return text;
}
async function generateViaGemini(promptText) {
    if (process.env.GEMINI_API_KEY?.trim()) {
        return generateViaGeminiApiKey(promptText);
    }
    return generateViaVertex(promptText);
}
/** OpenRouter chat completions (JSON mode). */
async function generateViaOpenRouter(promptText) {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey)
        throw new Error("OPENROUTER_API_KEY not set in cloud-run/.env");
    const model = openRouterModelName();
    const res = await (0, node_fetch_1.default)("https://openrouter.ai/api/v1/chat/completions", {
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
                    content: "You are a crisis-management AI. Reply with a single valid JSON object only. No markdown, no prose.",
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
    const data = (await res.json());
    if (data.error?.message) {
        throw new Error(`OpenRouter: ${data.error.message}`);
    }
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text.trim())
        throw new Error("OpenRouter returned empty response");
    return text;
}
async function generateRawText(provider, promptText) {
    if (provider === "groq")
        return generateViaGroq(promptText);
    if (provider === "openrouter")
        return generateViaOpenRouter(promptText);
    return generateViaGemini(promptText);
}
/**
 * Call LLM providers in order until JSON parses.
 * Default chain: Groq → OpenRouter → Gemini (when keys are set).
 */
async function generateAgentJson(promptPayload, options) {
    const promptText = JSON.stringify(promptPayload);
    const providers = resolveProviderOrder(options?.providers);
    if (!providers.length) {
        throw new Error("No LLM credentials. Set GROQ_API_KEY (recommended), or GEMINI_API_KEY / OPENROUTER_API_KEY in cloud-run/.env");
    }
    const errors = [];
    for (const provider of providers) {
        const t0 = Date.now();
        try {
            const text = await generateRawText(provider, promptText);
            const parsed = (0, agentJsonParse_1.parseAgentJsonText)(text);
            const ms = Date.now() - t0;
            if (provider !== providers[0]) {
                console.log(`[llm] Recovered via ${provider} in ${ms}ms`);
            }
            else {
                console.log(`[llm:${provider}] ok ${ms}ms`);
            }
            return parsed;
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`${provider}: ${msg.slice(0, 120)}`);
            console.warn(`[llm:${provider}] ${Date.now() - t0}ms —`, msg.slice(0, 160));
        }
    }
    const summary = errors.join(" | ");
    throw new Error(summary ||
        "LLM request failed. Set GROQ_API_KEY in cloud-run/.env and restart npm run dev.");
}
/** @deprecated Use generateAgentJson — kept for existing imports. */
exports.generateGeminiJson = generateAgentJson;
