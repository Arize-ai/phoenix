import z from "zod";

import { phoenixContentPartSchema } from "./messagePartSchemas";
import type { PromptChatMessage } from "../../../types/prompts";
import { schemaMatches } from "../../../utils/schemaMatches";

/**
 *
 * Prompt Message Schemas
 *
 */

export const phoenixMessageRoleSchema = z.enum([
  "SYSTEM",
  "USER",
  "AI",
  "TOOL",
]);

export type PhoenixMessageRole = z.infer<typeof phoenixMessageRoleSchema>;

export const phoenixMessageSchema = schemaMatches<PromptChatMessage>()(
  z.object({
    role: phoenixMessageRoleSchema,
    content: phoenixContentPartSchema.array(),
  })
);

export type PhoenixMessage = z.infer<typeof phoenixMessageSchema>;

export const phoenixMessagesSchema = z.array(phoenixMessageSchema);
