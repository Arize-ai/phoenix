import type { PromptChatMessage } from "../../../types/prompts";
import { schemaMatches } from "../../../utils/schemaMatches";

import { phoenixContentPartSchema } from "./messagePartSchemas";

import z from "zod";

/**
 *
 * Prompt Message Schemas
 *
 */

export const phoenixMessageRoleSchema = z.enum([
  "system",
  "developer",
  "user",
  "assistant",
  "model",
  "ai",
  "tool",
]);

export type PhoenixMessageRole = z.infer<typeof phoenixMessageRoleSchema>;

export const phoenixMessageSchema = schemaMatches<PromptChatMessage>()(
  z.object({
    role: phoenixMessageRoleSchema,
    content: z.union([z.string(), phoenixContentPartSchema.array()]),
  })
);

export type PhoenixMessage = z.infer<typeof phoenixMessageSchema>;

export const phoenixMessagesSchema = z.array(phoenixMessageSchema);
