import z from "zod";
import zodToJsonSchema from "zod-to-json-schema";

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
export const anthropicMessageSchema = z
  .object({
    role: anthropicMessageRoleSchema,
    content: z.union([z.string(), z.array(anthropicMessagePartSchema)]),
  })
  .passthrough();

export type AnthropicMessage = z.infer<typeof anthropicMessageSchema>;

export const anthropicMessagesSchema = z.array(anthropicMessageSchema);

// Type assertion needed due to TypeScript's deep type instantiation limits with complex recursive schemas
// This is safe because zodToJsonSchema works correctly at runtime regardless of TypeScript's type analysis
export const anthropicMessagesJSONSchema = zodToJsonSchema(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  anthropicMessagesSchema as any, // TODO: use zod4 toJSONSchema instead
  {
    removeAdditionalStrategy: "passthrough",
  }
);
