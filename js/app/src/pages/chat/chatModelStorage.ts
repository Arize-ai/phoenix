import { z } from "zod";

import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import type { GenerativeProviderKey } from "@phoenix/components/generative/useModelMenuData";
import { ModelProviders } from "@phoenix/constants/generativeConstants";

import type { ChatModelSelection } from "./chatModel";

export const CHAT_MODEL_LOCAL_STORAGE_KEY = "arize-phoenix-chat-model";

const GENERATIVE_PROVIDER_KEY_SCHEMA = z.custom<GenerativeProviderKey>(
  (provider) => typeof provider === "string" && provider in ModelProviders,
  { message: "Invalid model provider." }
);

const CHAT_MODEL_SCHEMA = z.object({
  provider: GENERATIVE_PROVIDER_KEY_SCHEMA,
  modelName: z.string().min(1),
  customProvider: z
    .object({ id: z.string().min(1), name: z.string() })
    .optional(),
}) satisfies z.ZodType<ModelMenuValue>;

const CHAT_MODEL_SELECTION_SCHEMA = z.union([
  z.object({ kind: z.literal("browser") }),
  z.object({ kind: z.literal("server"), model: CHAT_MODEL_SCHEMA }),
]) satisfies z.ZodType<ChatModelSelection>;

/**
 * Reads and validates the last-used chat model from localStorage.
 * Returns `null` if nothing is stored or the value fails validation.
 */
export function getStoredChatModel(): ChatModelSelection | null {
  try {
    const raw = localStorage.getItem(CHAT_MODEL_LOCAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const selection = CHAT_MODEL_SELECTION_SCHEMA.safeParse(JSON.parse(raw));
    return selection.success ? selection.data : null;
  } catch {
    return null;
  }
}

/**
 * Persists the chat model selection so the next visit starts on the same model.
 */
export function storeChatModel(selection: ChatModelSelection): void {
  localStorage.setItem(CHAT_MODEL_LOCAL_STORAGE_KEY, JSON.stringify(selection));
}
