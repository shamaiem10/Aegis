/** Back-compat re-exports — agents should import from llmGenerate. */
export {
  generateAgentJson,
  generateAgentJson as generateGeminiJson,
  generateRawText,
  generateViaOpenRouter,
  geminiModelName,
  gcpProjectId,
  gcpRegion,
  hasGeminiCredentials,
  hasOpenRouterCredentials,
  openRouterModelName,
  resolveProviderOrder,
  type GenerateAgentJsonOptions,
  type LlmProvider,
} from "./llmGenerate";

export { parseAgentJsonText, parseAgentJsonText as parseGeminiJsonText } from "../utils/agentJsonParse";
