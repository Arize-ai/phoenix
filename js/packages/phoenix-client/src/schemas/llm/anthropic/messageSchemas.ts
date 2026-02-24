import z from "zod";

import { anthropicMessagePartSchema } from "./messagePartSchemas";

/**
 *
 * Anthropic Message Schemas
 *
 */
export const anthropicMessageRoleSchema = z.enum(["user", "assistant"]);

export type AnthropicMessageRole = z.infer<typeof anthropicMessageRoleSchema>;

/**
 * TODO: rewrite as discriminated union
 */
export const anthropicMessageSchema = z.looseObject({
  role: anthropicMessageRoleSchema,
  content: z.union([z.string(), z.array(anthropicMessagePartSchema)]),
});

export type AnthropicMessage = z.infer<typeof anthropicMessageSchema>;

export const anthropicMessagesSchema = z.array(anthropicMessageSchema);

export const anthropicMessagesJSONSchema = z.toJSONSchema(
  anthropicMessagesSchema
);
