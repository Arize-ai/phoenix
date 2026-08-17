import { z } from "zod";

import type { ChatParameters } from "./chatParameters";
import { DEFAULT_CHAT_PARAMETERS } from "./chatParameters";

export const CHAT_PARAMETERS_LOCAL_STORAGE_KEY =
  "arize-phoenix-chat-parameters";

const CHAT_PARAMETERS_SCHEMA = z.object({
  systemPrompt: z.string(),
  temperature: z.number().min(0).max(2).nullable(),
  topP: z.number().min(0).max(1).nullable(),
  maxOutputTokens: z.number().int().positive().nullable(),
}) satisfies z.ZodType<ChatParameters>;

/**
 * Reads and validates the last-used chat parameters from localStorage.
 * Anything missing or malformed falls back to the defaults — every
 * parameter unset — rather than surfacing a broken half-state.
 */
export function getStoredChatParameters(): ChatParameters {
  try {
    const raw = localStorage.getItem(CHAT_PARAMETERS_LOCAL_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_CHAT_PARAMETERS;
    }
    const parsed = CHAT_PARAMETERS_SCHEMA.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_CHAT_PARAMETERS;
  } catch {
    return DEFAULT_CHAT_PARAMETERS;
  }
}

/**
 * Persists the chat parameters so the next visit starts with the same setup.
 */
export function storeChatParameters(parameters: ChatParameters): void {
  localStorage.setItem(
    CHAT_PARAMETERS_LOCAL_STORAGE_KEY,
    JSON.stringify(parameters)
  );
}
