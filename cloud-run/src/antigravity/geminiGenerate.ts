/** Back-compat re-exports — agents should import from llmGenerate. */
export {
  generateAgentJson,
  generateAgentJson as generateGeminiJson,
  generateRawText,
  generateViaGroq,
  generateViaOpenRouter,
  agentLlmProviders,
  geminiModelName,
  groqModelName,
  gcpProjectId,
  gcpRegion,
  hasGeminiCredentials,
  hasGroqCredentials,
  hasOpenRouterCredentials,
  openRouterModelName,
  resolveProviderOrder,
  type GenerateAgentJsonOptions,
  type LlmProvider,
} from "./llmGenerate";

export { parseAgentJsonText, parseAgentJsonText as parseGeminiJsonText } from "../utils/agentJsonParse";
