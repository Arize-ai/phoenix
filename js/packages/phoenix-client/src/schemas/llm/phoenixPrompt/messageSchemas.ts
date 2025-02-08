import z from "zod";

import {
  textPartSchema,
  toolCallPartSchema,
  imagePartSchema,
  toolResultPartSchema,
} from "./messagePartSchemas";

/**
 *
 * Prompt Message Schemas
 *
 */

export const promptMessageRoleSchema = z.enum(["SYSTEM", "USER", "AI", "TOOL"]);

export type PromptMessageRole = z.infer<typeof promptMessageRoleSchema>;

export const promptContentPartSchema = z.discriminatedUnion("type", [
  textPartSchema,
  imagePartSchema,
  toolCallPartSchema,
  toolResultPartSchema,
]);

export type PromptContentPart = z.infer<typeof promptContentPartSchema>;

export const promptMessageSchema = z
  .object({
    role: promptMessageRoleSchema,
    content: promptContentPartSchema.array(),
  })
  .passthrough();

export type PromptMessage = z.infer<typeof promptMessageSchema>;

export const promptMessagesSchema = z.array(promptMessageSchema);
