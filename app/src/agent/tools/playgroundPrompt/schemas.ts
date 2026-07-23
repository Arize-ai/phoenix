import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { z } from "zod";

import { emptyToolInputSchema } from "@phoenix/agent/tools/emptyToolInput";
import {
  chatMessageRolesSchema,
  chatMessageSchema,
} from "@phoenix/pages/playground/schemas";

export type PromptEditToolOutputSender = Chat<UIMessage>["addToolOutput"];

const promptToolCallsSchema = chatMessageSchema.shape.toolCalls.unwrap();

export const readPromptInputSchema = z
  .object({
    instanceId: z.number().int().optional(),
  })
  .transform(({ instanceId }) => {
    return typeof instanceId === "number" ? { instanceId } : {};
  });

export const clonePromptInstanceInputSchema = z
  .preprocess(
    (input) => normalizeAliases(input, { instanceId: ["instance_id"] }),
    z.object({
      instanceId: z.number().int().optional(),
    })
  )
  .transform(({ instanceId }) => {
    return typeof instanceId === "number" ? { instanceId } : {};
  });

export const addPromptInstanceInputSchema = emptyToolInputSchema;

export const removePromptInstanceInputSchema = z
  .preprocess(
    (input) => normalizeAliases(input, { instanceId: ["instance_id"] }),
    z.object({
      instanceId: z.number().int(),
    })
  )
  .transform((input) => input);

export const removePromptInstanceOutputSchema = z.object({
  status: z.enum(["removed", "rejected"]),
  instanceId: z.number().int().optional(),
  label: z.string().optional(),
  acceptedBy: z.string().optional(),
  message: z.string(),
});

const updatePromptMessageOperationSchema = z
  .object({
    type: z.literal("update_message"),
    messageId: z.number().int(),
    role: chatMessageRolesSchema.optional(),
    content: z.string().optional(),
    toolCalls: promptToolCallsSchema.optional(),
  })
  .transform((operation) => {
    return {
      type: "update_message" as const,
      messageId: operation.messageId,
      ...(operation.role ? { role: operation.role } : {}),
      ...(operation.content !== undefined
        ? { content: operation.content }
        : {}),
      ...(operation.toolCalls !== undefined
        ? { toolCalls: operation.toolCalls }
        : {}),
    };
  });

const insertPromptMessageOperationSchema = z
  .object({
    type: z.literal("insert_message"),
    afterMessageId: z.number().int().nullable().optional(),
    role: chatMessageRolesSchema,
    content: z.string().optional(),
    toolCalls: promptToolCallsSchema.optional(),
  })
  .transform((operation) => {
    return {
      type: "insert_message" as const,
      afterMessageId: operation.afterMessageId ?? null,
      role: operation.role,
      ...(operation.content !== undefined
        ? { content: operation.content }
        : {}),
      ...(operation.toolCalls !== undefined
        ? { toolCalls: operation.toolCalls }
        : {}),
    };
  });

export const editPromptOperationSchema = z.preprocess(
  (input) =>
    normalizeAliases(input, {
      afterMessageId: ["after_message_id"],
      messageId: ["message_id"],
      messageIds: ["message_ids"],
      toolCalls: ["tool_calls"],
    }),
  z.discriminatedUnion("type", [
    updatePromptMessageOperationSchema,
    insertPromptMessageOperationSchema,
    z.object({
      type: z.literal("delete_message"),
      messageId: z.number().int(),
    }),
    z.object({
      type: z.literal("reorder_messages"),
      messageIds: z.array(z.number().int()),
    }),
  ])
);

const editPromptOperationsSchema = z.preprocess((input) => {
  if (Array.isArray(input)) return input;
  return typeof input === "object" && input !== null ? [input] : input;
}, z.array(editPromptOperationSchema).min(1));

export const editPromptInputSchema = z
  .preprocess(
    (input) =>
      normalizeAliases(input, {
        expectedRevision: ["expected_revision"],
        instanceId: ["instance_id"],
        operations: ["operation"],
      }),
    z.object({
      instanceId: z.number().int(),
      expectedRevision: z.string(),
      operations: editPromptOperationsSchema,
    })
  )
  .transform((input) => input);

export const editPromptActionContextSchema = z
  .object({
    toolCallId: z.string(),
    sessionId: z.string(),
    addToolOutput: z.custom<PromptEditToolOutputSender>(
      (value) => typeof value === "function"
    ),
  })
  .transform((context) => context);

/** Local guard: a non-null, non-array object whose properties can be read by key. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Copies aliased keys (e.g. snake_case) to their canonical names (camelCase)
 * before Zod parsing. Canonical keys take precedence if both are present.
 */
export function normalizeAliases(
  input: unknown,
  aliasesByKey: Record<string, string[]>
): unknown {
  if (!isPlainRecord(input)) {
    return input;
  }
  const candidate = input;
  const normalized = { ...candidate };
  for (const [key, aliases] of Object.entries(aliasesByKey)) {
    if (normalized[key] !== undefined) continue;
    const alias = aliases.find(
      (candidateAlias) => candidate[candidateAlias] !== undefined
    );
    if (alias) {
      normalized[key] = candidate[alias];
    }
  }
  return normalized;
}
