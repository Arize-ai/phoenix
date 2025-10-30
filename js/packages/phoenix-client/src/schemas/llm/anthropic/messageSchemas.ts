import { anthropicMessagePartSchema } from "./messagePartSchemas";

import z from "zod";
import zodToJsonSchema from "zod-to-json-schema";

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
export const anthropicMessageSchema = z
  .object({
    role: anthropicMessageRoleSchema,
    content: z.union([z.string(), z.array(anthropicMessagePartSchema)]),
  })
  .passthrough();

export type AnthropicMessage = z.infer<typeof anthropicMessageSchema>;

export const anthropicMessagesSchema = z.array(anthropicMessageSchema);

export const anthropicMessagesJSONSchema = zodToJsonSchema(
  anthropicMessagesSchema,
  {
    removeAdditionalStrategy: "passthrough",
  }
);
