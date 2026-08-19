import { z } from "zod";

import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { modelProviderSchema } from "@phoenix/utils/generativeUtils";
import { createScopedStorageItem } from "@phoenix/utils/storageUtils";

import type { ChatModelSelection } from "./chatModel";

const CHAT_MODEL_SCHEMA = z.object({
  provider: modelProviderSchema,
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
 * The last-used chat model, persisted so the next visit starts on the same
 * model. Returns `null` when nothing valid is stored.
 */
export const {
  resolveKey: resolveChatModelStorageKey,
  get: getStoredChatModel,
  set: storeChatModel,
} = createScopedStorageItem({
  baseKey: "arize-phoenix-chat-model",
  schema: CHAT_MODEL_SELECTION_SCHEMA,
  fallback: null,
});
