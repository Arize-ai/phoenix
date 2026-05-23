import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { z } from "zod";

import { normalizeAliases } from "@phoenix/agent/tools/playgroundPrompt";

export type CodeEvaluatorEditToolOutputSender =
  Chat<UIMessage>["addToolOutput"];

const codeEvaluatorLanguageSchema = z.enum(["PYTHON", "TYPESCRIPT"]);

const inputMappingSchema = z
  .object({
    pathMapping: z.record(z.string(), z.string()).optional(),
    literalMapping: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
  })
  .transform((value) => ({
    pathMapping: value.pathMapping ?? {},
    literalMapping: value.literalMapping ?? {},
  }));

export const readCodeEvaluatorDraftInputSchema = z
  .object({})
  .passthrough()
  .transform(() => ({}));

const setSourceCodeOperationSchema = z.object({
  type: z.literal("set_source_code"),
  sourceCode: z.string(),
});

const setLanguageOperationSchema = z.object({
  type: z.literal("set_language"),
  language: codeEvaluatorLanguageSchema,
});

const setSandboxConfigOperationSchema = z.object({
  type: z.literal("set_sandbox_config"),
  sandboxConfigId: z.string().nullable(),
});

const setInputMappingOperationSchema = z.object({
  type: z.literal("set_input_mapping"),
  inputMapping: inputMappingSchema,
});

const setDescriptionOperationSchema = z.object({
  type: z.literal("set_description"),
  description: z.string(),
});

const setNameOperationSchema = z.object({
  type: z.literal("set_name"),
  name: z.string(),
});

export const editCodeEvaluatorDraftOperationSchema = z.preprocess(
  (input) =>
    normalizeAliases(input, {
      sourceCode: ["source_code"],
      sandboxConfigId: ["sandbox_config_id"],
      inputMapping: ["input_mapping"],
    }),
  z.discriminatedUnion("type", [
    setSourceCodeOperationSchema,
    setLanguageOperationSchema,
    setSandboxConfigOperationSchema,
    setInputMappingOperationSchema,
    setDescriptionOperationSchema,
    setNameOperationSchema,
  ])
);

const editCodeEvaluatorDraftOperationsSchema = z.preprocess((input) => {
  if (Array.isArray(input)) return input;
  return typeof input === "object" && input !== null ? [input] : input;
}, z.array(editCodeEvaluatorDraftOperationSchema).min(1));

export const editCodeEvaluatorDraftInputSchema = z
  .preprocess(
    (input) =>
      normalizeAliases(input, {
        expectedRevision: ["expected_revision"],
        operations: ["operation"],
      }),
    z.object({
      expectedRevision: z.string(),
      operations: editCodeEvaluatorDraftOperationsSchema,
    })
  )
  .transform((input) => input);

export const editCodeEvaluatorDraftActionContextSchema = z
  .object({
    toolCallId: z.string(),
    sessionId: z.string(),
    addToolOutput: z.custom<CodeEvaluatorEditToolOutputSender>(
      (value) => typeof value === "function"
    ),
  })
  .transform((context) => context);
