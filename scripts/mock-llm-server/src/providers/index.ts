// Types
export type {
  Provider,
  ValidationResult,
  HandlerConfig,
  EndpointId,
} from "./types.js";
export { ENDPOINT_IDS, ENDPOINT_LABELS } from "./types.js";

// Provider implementations
export { openaiChatProvider } from "./openai-chat.js";
export { openaiResponsesProvider } from "./openai-responses.js";
export { anthropicProvider } from "./anthropic.js";
export {
  geminiGenerateProvider,
  geminiStreamProvider,
  geminiGenerateV1Provider,
  geminiStreamV1Provider,
} from "./gemini.js";

// All providers
import { openaiChatProvider } from "./openai-chat.js";
import { openaiResponsesProvider } from "./openai-responses.js";
import { anthropicProvider } from "./anthropic.js";
import {
  geminiGenerateProvider,
  geminiStreamProvider,
  geminiGenerateV1Provider,
  geminiStreamV1Provider,
} from "./gemini.js";
import type { Provider } from "./types.js";

export const ALL_PROVIDERS: Provider[] = [
  openaiChatProvider,
  openaiResponsesProvider,
  anthropicProvider,
  geminiGenerateProvider,
  geminiStreamProvider,
  geminiGenerateV1Provider,
  geminiStreamV1Provider,
];
