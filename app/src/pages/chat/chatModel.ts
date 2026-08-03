import type { LanguageModel } from "ai";

import { authFetch } from "@phoenix/authFetch";
import { createBrowserModel } from "@phoenix/components/generative/browserAI";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { prependBasename } from "@phoenix/utils/routingUtils";

/**
 * What the chat runs on: Browser AI — the browser's built-in on-device
 * model — or a provider model served through the Phoenix server's
 * OpenAI-compatible proxy.
 */
export type ChatModelSelection =
  | { kind: "browser" }
  | { kind: "server"; model: ModelMenuValue };

/**
 * Encodes a model selection as the model string the Phoenix server's
 * OpenAI-compatible `/v1/chat/completions` endpoint understands:
 * `{provider}:{model_name}` for built-in providers and
 * `custom:{provider_id}:{model_name}` for stored custom provider records.
 * The server splits on the first colon(s), so model names containing colons
 * (e.g. `llama3:8b`) survive intact.
 */
export function toChatModelId(model: ModelMenuValue): string {
  if (model.customProvider) {
    return `custom:${model.customProvider.id}:${model.modelName}`;
  }
  return `${model.provider.toLowerCase()}:${model.modelName}`;
}

/**
 * Resolves a chat model selection to a runnable AI SDK model. Browser AI
 * runs entirely on-device; server models talk to the Phoenix server's
 * OpenAI-compatible chat completions proxy, where credentials are resolved
 * and requests ride on the app's normal auth (cookie or refreshed token via
 * `authFetch`) — no key ever reaches this client. The proxy adapter loads
 * on demand so it doesn't weigh down the main bundle.
 */
export async function createChatModel(
  selection: ChatModelSelection
): Promise<LanguageModel> {
  if (selection.kind === "browser") {
    return createBrowserModel();
  }
  const { model } = selection;
  const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
  const baseURL = new URL(
    prependBasename("/v1"),
    window.location.origin
  ).toString();
  return createOpenAICompatible({
    name: "phoenix",
    baseURL,
    fetch: authFetch,
    // Ask the proxy for the final usage chunk so the page can report token
    // totals per conversation.
    includeUsage: true,
  })(toChatModelId(model));
}
