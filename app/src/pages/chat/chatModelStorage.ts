import { z } from "zod";

import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import type { GenerativeProviderKey } from "@phoenix/components/generative/useModelMenuData";

import type { ChatModelSelection } from "./chatModel";

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

const CHAT_MODEL_SELECTION_SCHEMA = z.union([
  z.object({ kind: z.literal("browser") }),
  z.object({ kind: z.literal("server"), model: CHAT_MODEL_SCHEMA }),
]) satisfies z.ZodType<ChatModelSelection>;

/**
 * Reads and validates the last-used chat model from localStorage. The
 * pre-Browser-AI shape was the bare server model; it is still accepted and
 * normalized to a server selection so an existing preference keeps working.
 * Returns `null` if nothing is stored or the value fails validation.
 */
export function getStoredChatModel(): ChatModelSelection | null {
  try {
    const raw = localStorage.getItem(CHAT_MODEL_LOCAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    const selection = CHAT_MODEL_SELECTION_SCHEMA.safeParse(parsed);
    if (selection.success) {
      return selection.data;
    }
    const legacy = CHAT_MODEL_SCHEMA.safeParse(parsed);
    return legacy.success ? { kind: "server", model: legacy.data } : null;
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
