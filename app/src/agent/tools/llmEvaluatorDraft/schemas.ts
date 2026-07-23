import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { z } from "zod";

import { outputConfigDraftSchema } from "@phoenix/agent/tools/codeEvaluatorDraft";
import { emptyToolInputSchema } from "@phoenix/agent/tools/emptyToolInput";
import { normalizeAliases } from "@phoenix/agent/tools/playgroundPrompt";

export type LlmEvaluatorEditToolOutputSender = Chat<UIMessage>["addToolOutput"];

export const readLlmEvaluatorDraftInputSchema = emptyToolInputSchema;

export const testLlmEvaluatorDraftInputSchema = emptyToolInputSchema;

// normalize* maps the model's snake_case keys onto the camelCase fields these schemas expect.
function normalizeInputMappingAliases(input: unknown): unknown {
  return normalizeAliases(input, {
    pathMapping: ["path_mapping"],
    literalMapping: ["literal_mapping"],
  });
}

/** Local guard: a non-null, non-array object whose properties can be read by key. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEditLlmEvaluatorDraftInput(input: unknown): unknown {
  const normalized = normalizeAliases(input, {
    operations: ["operation"],
  });
  if (!isPlainRecord(normalized)) {
    return normalized;
  }
  if (
    normalized.operations === undefined &&
    typeof normalized.type === "string"
  ) {
    return { operations: [normalized] };
  }
  return normalized;
}

const inputMappingSchema = z
  .preprocess(
    normalizeInputMappingAliases,
    z.object({
      pathMapping: z.record(z.string(), z.string()).optional(),
      literalMapping: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .optional(),
    })
  )
  .transform((value) => ({
    pathMapping: value.pathMapping ?? {},
    literalMapping: value.literalMapping ?? {},
  }));

const testPayloadSchema = z
  .preprocess(
    (input) =>
      normalizeAliases(input, {
        input: ["inputs"],
        output: ["outputs"],
      }),
    z.object({
      input: z.record(z.string(), z.unknown()).optional(),
      output: z.record(z.string(), z.unknown()).optional(),
      reference: z.record(z.string(), z.unknown()).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
  )
  .transform((value) => ({
    input: value.input ?? {},
    output: value.output ?? {},
    reference: value.reference ?? {},
    metadata: value.metadata ?? {},
  }));

const setNameOperationSchema = z.object({
  type: z.literal("set_name"),
  name: z.string(),
});

const setDescriptionOperationSchema = z.object({
  type: z.literal("set_description"),
  description: z.string(),
});

const setInputMappingOperationSchema = z.object({
  type: z.literal("set_input_mapping"),
  inputMapping: inputMappingSchema,
});

const setTestPayloadOperationSchema = z.object({
  type: z.literal("set_test_payload"),
  testPayload: testPayloadSchema,
});

const setIncludeExplanationOperationSchema = z.object({
  type: z.literal("set_include_explanation"),
  includeExplanation: z.boolean(),
});

const setOutputConfigsOperationSchema = z.object({
  type: z.literal("set_output_configs"),
  outputConfigs: z.array(outputConfigDraftSchema),
});

const judgeMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

const setJudgePromptOperationSchema = z.object({
  type: z.literal("set_judge_prompt"),
  messages: z.array(judgeMessageSchema),
  templateFormat: z.string().optional(),
});

const setJudgeModelOperationSchema = z.object({
  type: z.literal("set_judge_model"),
  model: z.string(),
  provider: z.string(),
  invocationParameters: z.record(z.string(), z.unknown()).optional(),
});

export const editLlmEvaluatorDraftOperationSchema = z.preprocess(
  (input) =>
    normalizeAliases(input, {
      inputMapping: ["input_mapping"],
      testPayload: ["test_payload"],
      includeExplanation: ["include_explanation"],
      outputConfigs: ["output_configs"],
      templateFormat: ["template_format"],
      invocationParameters: ["invocation_parameters"],
    }),
  z.discriminatedUnion("type", [
    setNameOperationSchema,
    setDescriptionOperationSchema,
    setInputMappingOperationSchema,
    setTestPayloadOperationSchema,
    setIncludeExplanationOperationSchema,
    setOutputConfigsOperationSchema,
    setJudgePromptOperationSchema,
    setJudgeModelOperationSchema,
  ])
);

const editLlmEvaluatorDraftOperationsSchema = z.preprocess((input) => {
  if (Array.isArray(input)) return input;
  return typeof input === "object" && input !== null ? [input] : input;
}, z.array(editLlmEvaluatorDraftOperationSchema).min(1));

export const editLlmEvaluatorDraftInputSchema = z
  .preprocess(
    normalizeEditLlmEvaluatorDraftInput,
    z.object({
      operations: editLlmEvaluatorDraftOperationsSchema,
    })
  )
  .transform((input) => input);

export const editLlmEvaluatorDraftActionContextSchema = z
  .object({
    toolCallId: z.string(),
    sessionId: z.string(),
    addToolOutput: z.custom<LlmEvaluatorEditToolOutputSender>(
      (value) => typeof value === "function"
    ),
  })
  .transform((context) => context);
