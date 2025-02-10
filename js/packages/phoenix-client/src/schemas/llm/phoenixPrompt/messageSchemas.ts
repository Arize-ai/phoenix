import z from "zod";

import { phoenixPromptContentPartSchema } from "./messagePartSchemas";
import type { PromptChatMessage } from "../../../types/prompts";
import { schemaMatches } from "../../../utils/schemaMatches";

/**
 *
 * Prompt Message Schemas
 *
 */

export const promptMessageRoleSchema = z.enum(["SYSTEM", "USER", "AI", "TOOL"]);

export type PromptMessageRole = z.infer<typeof promptMessageRoleSchema>;

export const promptMessageSchema = schemaMatches<PromptChatMessage>()(
  z.object({
    role: promptMessageRoleSchema,
    content: phoenixPromptContentPartSchema.array(),
  })
);

export type PromptMessage = z.infer<typeof promptMessageSchema>;

export const promptMessagesSchema = z.array(promptMessageSchema);
