import { z } from "zod";

import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import type { GenerativeProviderKey } from "@phoenix/components/generative/useModelMenuData";

export const CHAT_MODEL_LOCAL_STORAGE_KEY = "arize-phoenix-chat-model";

const GENERATIVE_PROVIDER_KEY_SCHEMA = z.enum([
  "ANTHROPIC",
  "AWS",
  "AZURE_OPENAI",
  "CEREBRAS",
  "DEEPSEEK",
  "FIREWORKS",
  "GOOGLE",
  "GROQ",
  "MOONSHOT",
  "OLLAMA",
  "OPENAI",
  "PERPLEXITY",
  "TOGETHER",
  "XAI",
]) satisfies z.ZodType<GenerativeProviderKey>;

const CHAT_MODEL_SCHEMA = z.object({
  provider: GENERATIVE_PROVIDER_KEY_SCHEMA,
  modelName: z.string().min(1),
  customProvider: z
    .object({ id: z.string().min(1), name: z.string() })
    .optional(),
}) satisfies z.ZodType<ModelMenuValue>;

/**
 * Reads and validates the last-used chat model from localStorage.
 * Returns `null` if nothing is stored or the value fails validation.
 */
export function getStoredChatModel(): ModelMenuValue | null {
  try {
    const raw = localStorage.getItem(CHAT_MODEL_LOCAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return CHAT_MODEL_SCHEMA.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Persists the chat model selection so the next visit starts on the same model.
 */
export function storeChatModel(model: ModelMenuValue): void {
  localStorage.setItem(CHAT_MODEL_LOCAL_STORAGE_KEY, JSON.stringify(model));
}
