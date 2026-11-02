import { z } from "zod";

import { CHAT_PARAMETERS_STORAGE_BASE_KEY } from "@phoenix/constants/storageConstants";
import { createScopedStorageItem } from "@phoenix/utils/storageUtils";

import type { ChatParameters } from "./chatParameters";
import { DEFAULT_CHAT_PARAMETERS } from "./chatParameters";

const CHAT_PARAMETERS_SCHEMA = z.object({
  systemPrompt: z.string(),
  temperature: z.number().min(0).max(2).nullable(),
  topP: z.number().min(0).max(1).nullable(),
  maxOutputTokens: z.number().int().positive().nullable(),
}) satisfies z.ZodType<ChatParameters>;

/**
 * The last-used chat parameters, persisted so the next visit starts with the
 * same setup. Anything missing or malformed reads back as the defaults —
 * every parameter unset — rather than surfacing a broken half-state.
 */
export const {
  resolveKey: resolveChatParametersStorageKey,
  get: getStoredChatParameters,
  set: storeChatParameters,
} = createScopedStorageItem({
  baseKey: CHAT_PARAMETERS_STORAGE_BASE_KEY,
  schema: CHAT_PARAMETERS_SCHEMA,
  fallback: DEFAULT_CHAT_PARAMETERS,
});
