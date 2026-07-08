import z from "zod";

import {
  openaiChatPartImageSchema,
  openaiChatPartTextSchema,
} from "./messagePartSchemas";
import { openAIToolCallSchema } from "./toolCallSchemas";

/*
 *
 * OpenAI Message Schemas
 *
 */

export const openAIMessageRoleSchema = z.enum([
  "system",
  "user",
  "assistant",
  "developer",
  "tool",
  // "function",
]);

export type OpenAIMessageRole = z.infer<typeof openAIMessageRoleSchema>;

export const openAIMessageSchema = z.discriminatedUnion("role", [
  z.looseObject({
    role: z.literal("assistant"),
    content: z.union([openaiChatPartTextSchema.array(), z.string()]),
    name: z.string().optional(),
    tool_call_id: z.string().optional(),
    tool_calls: z.array(openAIToolCallSchema).optional(),
  }),
  z.looseObject({
    role: z.literal("tool"),
    content: z.union([openaiChatPartTextSchema.array(), z.string()]),
    tool_call_id: z.string(),
  }),
  z.looseObject({
    role: z.literal("function"),
    content: z.string().nullable(),
    name: z.string(),
  }),
  z.looseObject({
    role: z.literal("user"),
    content: z.union([
      z.array(z.union([openaiChatPartTextSchema, openaiChatPartImageSchema])),
      z.string(),
    ]),
    name: z.string().optional(),
  }),
  z.looseObject({
    role: z.literal("system"),
    content: z.union([openaiChatPartTextSchema.array(), z.string()]),
    name: z.string().optional(),
  }),
  z.looseObject({
    role: z.literal("developer"),
    content: z.union([openaiChatPartTextSchema.array(), z.string()]),
    name: z.string().optional(),
  }),
]);

export type OpenAIMessage = z.infer<typeof openAIMessageSchema>;

export const openAIMessagesSchema = z.array(openAIMessageSchema);
