import type { LanguageModel } from "ai";

import { authFetch } from "@phoenix/authFetch";
import { prependBasename } from "@phoenix/utils/routingUtils";

/**
 * Encodes a provider model as the model string the Phoenix server's
 * OpenAI-compatible `/v1/chat/completions` endpoint understands:
 * `{provider}:{model_name}` for built-in providers and
 * `custom:{provider_id}:{model_name}` for stored custom provider records.
 * The server splits on the first colon(s), so model names containing colons
 * (e.g. `llama3:8b`) survive intact.
 */
export function encodeServerModelId(
  model:
    | { provider: string; modelName: string }
    | { customProviderId: string; modelName: string }
): string {
  return "customProviderId" in model
    ? `custom:${model.customProviderId}:${model.modelName}`
    : `${model.provider.toLowerCase()}:${model.modelName}`;
}

/**
 * Creates an AI SDK model backed by the Phoenix server's OpenAI-compatible
 * `/v1/chat/completions` proxy. Credentials are resolved on the server and
 * requests ride on the app's normal auth — the cookie carries the session
 * and `authFetch` refreshes an expired token — so no key ever reaches the
 * browser. The adapter loads on demand so it doesn't weigh down the main
 * bundle.
 *
 * `modelId` is the proxy's wire format — encode it with
 * {@link encodeServerModelId}.
 */
export async function createServerLanguageModel(
  modelId: string,
  options?: {
    /**
     * Ask the proxy for the final usage chunk so callers can report token
     * totals.
     */
    includeUsage?: boolean;
  }
): Promise<LanguageModel> {
  const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
  const baseURL = new URL(
    prependBasename("/v1"),
    window.location.origin
  ).toString();
  return createOpenAICompatible({
    name: "phoenix",
    baseURL,
    fetch: authFetch,
    includeUsage: options?.includeUsage,
  })(modelId);
}
