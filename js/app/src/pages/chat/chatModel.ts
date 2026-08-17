import type { LanguageModel } from "ai";

import { createBrowserModel } from "@phoenix/components/generative/browserAI";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import {
  createServerLanguageModel,
  encodeServerModelId,
} from "@phoenix/components/generative/serverLanguageModel";

/**
 * What the chat runs on: Browser AI — the browser's built-in on-device
 * model — or a provider model served through the Phoenix server's
 * OpenAI-compatible proxy.
 */
export type ChatModelSelection =
  | { kind: "browser" }
  | { kind: "server"; model: ModelMenuValue };

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
  const { provider, modelName, customProvider } = selection.model;
  return createServerLanguageModel(
    encodeServerModelId(
      customProvider
        ? { customProviderId: customProvider.id, modelName }
        : { provider, modelName }
    ),
    { includeUsage: true }
  );
}
