import {
  vercelAIChatPartImageSchema,
  vercelAIChatPartTextSchema,
  vercelAIChatPartToolCallSchema,
  vercelAIChatPartToolResultSchema,
} from "./messagePartSchemas";

import z from "zod";

/*
 *
 * Vercel AI SDK Message Schemas
 *
 */

export const vercelAIMessageRoleSchema = z.enum([
  "system",
  "user",
  "assistant",
  "tool",
]);

export type VercelAIMessageRole = z.infer<typeof vercelAIMessageRoleSchema>;

export const vercelAIMessageSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("system"),
    content: z.string(),
  }),
  z.object({
    role: z.literal("user"),
    content: z.union([
      z
        .union([vercelAIChatPartTextSchema, vercelAIChatPartImageSchema])
        .array(),
      z.string(),
    ]),
  }),
  z.object({
    role: z.literal("assistant"),
    content: z.union([
      z
        .union([vercelAIChatPartTextSchema, vercelAIChatPartToolCallSchema])
        .array(),
      z.string(),
    ]),
  }),
  z.object({
    role: z.literal("tool"),
    content: vercelAIChatPartToolResultSchema.array(),
  }),
]);

export type VercelAIMessage = z.infer<typeof vercelAIMessageSchema>;
