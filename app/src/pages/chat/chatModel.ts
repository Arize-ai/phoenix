import type { LanguageModel } from "ai";

import { createBrowserModel } from "@phoenix/components/generative/browserAI";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { createServerLanguageModel } from "@phoenix/components/generative/serverLanguageModel";

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
 * runs entirely on-device; server models stream through the Phoenix
 * server's OpenAI-compatible proxy with usage reporting enabled so the page
 * can show per-conversation token totals.
 */
export async function createChatModel(
  selection: ChatModelSelection
): Promise<LanguageModel> {
  if (selection.kind === "browser") {
    return createBrowserModel();
  }
  return createServerLanguageModel(toChatModelId(selection.model), {
    includeUsage: true,
  });
}
