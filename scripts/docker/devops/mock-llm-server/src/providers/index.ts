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
export { openaiDecisionsProvider } from "./openai-decisions.js";
export { anthropicProvider } from "./anthropic.js";
export {
  geminiGenerateProvider,
  geminiStreamProvider,
  geminiGenerateV1Provider,
  geminiStreamV1Provider,
} from "./gemini.js";
export { typesafeProvider } from "./typesafe.js";

import { anthropicProvider } from "./anthropic.js";
import {
  geminiGenerateProvider,
  geminiStreamProvider,
  geminiGenerateV1Provider,
  geminiStreamV1Provider,
} from "./gemini.js";
// All providers
import { openaiChatProvider } from "./openai-chat.js";
import { openaiDecisionsProvider } from "./openai-decisions.js";
import { openaiResponsesProvider } from "./openai-responses.js";
import type { Provider } from "./types.js";
import { typesafeProvider } from "./typesafe.js";

export const ALL_PROVIDERS: Provider[] = [
  openaiChatProvider,
  openaiResponsesProvider,
  openaiDecisionsProvider,
  anthropicProvider,
  geminiGenerateProvider,
  geminiStreamProvider,
  geminiGenerateV1Provider,
  geminiStreamV1Provider,
  typesafeProvider,
];
