import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { z } from "zod";

import { normalizeAliases } from "@phoenix/agent/tools/playgroundPrompt";

export type PromptToolsWriteToolOutputSender = Chat<UIMessage>["addToolOutput"];

export const readPromptToolsInputSchema = z
  .preprocess(
    (input) => normalizeAliases(input, { instanceId: ["instance_id"] }),
    z.object({
      instanceId: z.number().int().optional(),
    })
  )
  .transform(({ instanceId }) => {
    return typeof instanceId === "number" ? { instanceId } : {};
  });

const writePromptToolFunctionToolSchema = z
  .preprocess(
    (input) =>
      normalizeAliases(input, {
        // Lenient on snake_case the model may emit.
      }),
    z.object({
      id: z.number().int().nullable().optional(),
      name: z.string().trim().min(1),
      description: z.string().nullable().optional(),
      parameters: z.record(z.string(), z.unknown()).nullable().optional(),
      strict: z.boolean().nullable().optional(),
    })
  )
  .transform((value) => ({
    ...(value.id != null ? { id: value.id } : {}),
    name: value.name,
    ...(value.description !== undefined
      ? { description: value.description }
      : {}),
    ...(value.parameters !== undefined ? { parameters: value.parameters } : {}),
    ...(value.strict !== undefined ? { strict: value.strict } : {}),
  }));

export const writePromptToolsInputSchema = z
  .preprocess(
    (input) =>
      normalizeAliases(input, {
        expectedRevision: ["expected_revision", "revision"],
        instanceId: ["instance_id"],
        deleteToolIds: ["delete_tool_ids", "deleteIds", "delete_ids"],
      }),
    z.object({
      instanceId: z.number().int(),
      expectedRevision: z.string(),
      tools: z.array(writePromptToolFunctionToolSchema).optional(),
      deleteToolIds: z.array(z.number().int()).optional(),
    })
  )
  .refine(
    (value) =>
      (value.tools?.length ?? 0) > 0 || (value.deleteToolIds?.length ?? 0) > 0,
    { message: "Provide at least one tool to create/update or delete." }
  );

/**
 * Runtime context the tool registry hands to the write_prompt_tools client
 * action so it can register a pending approval bound to the live tool call.
 */
export const promptToolsActionContextSchema = z
  .object({
    toolCallId: z.string(),
    sessionId: z.string(),
    addToolOutput: z.custom<PromptToolsWriteToolOutputSender>(
      (value) => typeof value === "function"
    ),
  })
  .transform((context) => context);
