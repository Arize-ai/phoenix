import { jsonLiteralSchema } from "../../jsonLiteralSchema";

import z from "zod";

/*
 *
 * Vercel AI SDK Message Part Schemas
 *
 */

export const vercelAIChatPartTextSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

export type VercelAIChatPartText = z.infer<typeof vercelAIChatPartTextSchema>;

export const vercelAIChatPartImageSchema = z.object({
  type: z.literal("image"),
  image: z.string(), // ai supports more, but we will just support base64 for now
  mimeType: z.string().optional(),
});

export type VercelAIChatPartImage = z.infer<typeof vercelAIChatPartImageSchema>;

export const vercelAIChatPartToolCallSchema = z.object({
  type: z.literal("tool-call"),
  toolCallId: z.string(),
  toolName: z.string(),
  input: jsonLiteralSchema, // json serializable parameters
});

export type VercelAIChatPartToolCall = z.infer<
  typeof vercelAIChatPartToolCallSchema
>;

export const vercelAIChatPartToolResultSchema = z.object({
  type: z.literal("tool-result"),
  toolCallId: z.string(),
  toolName: z.string(),
  output: z.object({
    type: z.literal("text"), // TODO: extend to support other output types
    value: z.string(),
  }),
});

export type VercelAIChatPartToolResult = z.infer<
  typeof vercelAIChatPartToolResultSchema
>;

export const vercelAIChatPartSchema = z.discriminatedUnion("type", [
  vercelAIChatPartTextSchema,
  vercelAIChatPartImageSchema,
  vercelAIChatPartToolCallSchema,
  vercelAIChatPartToolResultSchema,
]);

export type VercelAIChatPart = z.infer<typeof vercelAIChatPartSchema>;
