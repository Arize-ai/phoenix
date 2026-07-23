import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { z } from "zod";

import { emptyToolInputSchema } from "@phoenix/agent/tools/emptyToolInput";
import {
  evaluatorDraftPreviewInputSchema,
  evaluatorMappingSourceSchema,
} from "@phoenix/agent/tools/evaluatorDraftPreview";
import { normalizeAliases } from "@phoenix/agent/tools/playgroundPrompt";
import {
  CODE_EVALUATOR_LANGUAGES,
  EVALUATOR_OPTIMIZATION_DIRECTIONS,
} from "@phoenix/types";

import type { OutputConfigDraft } from "./types";

export type CodeEvaluatorEditToolOutputSender =
  Chat<UIMessage>["addToolOutput"];

// The Python tool schema (agents/tools/*) is the model-facing source of truth
// for these enums; this TS layer only validates what the client dispatches.
const codeEvaluatorLanguageSchema = z.enum(CODE_EVALUATOR_LANGUAGES);

const optimizationDirectionSchema = z.enum(EVALUATOR_OPTIMIZATION_DIRECTIONS);
const outputConfigNameSchema = z.string().trim().min(1);

// The `normalize*` helpers map the model's snake_case keys onto the camelCase
// field names these schemas expect (see normalizeAliases).
function normalizeInputMappingAliases(input: unknown): unknown {
  return normalizeAliases(input, {
    pathMapping: ["path_mapping"],
    literalMapping: ["literal_mapping"],
  });
}

function normalizeOutputConfigAliases(input: unknown): unknown {
  return normalizeAliases(input, {
    optimizationDirection: ["optimization_direction"],
    lowerBound: ["lower_bound"],
    upperBound: ["upper_bound"],
  });
}

function normalizeEditCodeEvaluatorDraftInput(input: unknown): unknown {
  const normalized = normalizeAliases(input, {
    operations: ["operation"],
  });
  if (
    typeof normalized !== "object" ||
    normalized === null ||
    Array.isArray(normalized)
  ) {
    return normalized;
  }
  const candidate = normalized as Record<string, unknown>;
  if (
    candidate.operations === undefined &&
    typeof candidate.type === "string"
  ) {
    return { operations: [candidate] };
  }
  return normalized;
}

const classificationValueSchema = z.object({
  label: z.string(),
  score: z.number().nullish(),
});

const classificationOutputConfigDraftSchema = z.object({
  kind: z.literal("classification"),
  name: outputConfigNameSchema,
  optimizationDirection: optimizationDirectionSchema,
  values: z.array(classificationValueSchema),
});

const continuousOutputConfigDraftSchema = z.object({
  kind: z.literal("continuous"),
  name: outputConfigNameSchema,
  optimizationDirection: optimizationDirectionSchema,
  lowerBound: z.number().nullish(),
  upperBound: z.number().nullish(),
});

const freeformOutputConfigDraftSchema = z.object({
  kind: z.literal("freeform"),
  name: outputConfigNameSchema,
  optimizationDirection: optimizationDirectionSchema,
  threshold: z.number().nullish(),
  lowerBound: z.number().nullish(),
  upperBound: z.number().nullish(),
});

const outputConfigDraftUnionSchema = z.discriminatedUnion("kind", [
  classificationOutputConfigDraftSchema,
  continuousOutputConfigDraftSchema,
  freeformOutputConfigDraftSchema,
]) satisfies z.ZodType<OutputConfigDraft>;

export const outputConfigDraftSchema = z.preprocess(
  normalizeOutputConfigAliases,
  outputConfigDraftUnionSchema
);

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

export const readCodeEvaluatorDraftInputSchema = emptyToolInputSchema;

export const testCodeEvaluatorDraftInputSchema =
  evaluatorDraftPreviewInputSchema;

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

const setTestPayloadOperationSchema = z.object({
  type: z.literal("set_test_payload"),
  testPayload: evaluatorMappingSourceSchema,
});

const setDescriptionOperationSchema = z.object({
  type: z.literal("set_description"),
  description: z.string(),
});

const setNameOperationSchema = z.object({
  type: z.literal("set_name"),
  name: z.string(),
});

const setOutputConfigsOperationSchema = z.object({
  type: z.literal("set_output_configs"),
  outputConfigs: z.array(outputConfigDraftSchema),
});

export const editCodeEvaluatorDraftOperationSchema = z.preprocess(
  (input) =>
    normalizeAliases(input, {
      sourceCode: ["source_code"],
      sandboxConfigId: ["sandbox_config_id"],
      inputMapping: ["input_mapping"],
      testPayload: ["test_payload"],
      outputConfigs: ["output_configs"],
    }),
  z.discriminatedUnion("type", [
    setSourceCodeOperationSchema,
    setLanguageOperationSchema,
    setSandboxConfigOperationSchema,
    setInputMappingOperationSchema,
    setTestPayloadOperationSchema,
    setDescriptionOperationSchema,
    setNameOperationSchema,
    setOutputConfigsOperationSchema,
  ])
);

const editCodeEvaluatorDraftOperationsSchema = z.preprocess((input) => {
  if (Array.isArray(input)) return input;
  return typeof input === "object" && input !== null ? [input] : input;
}, z.array(editCodeEvaluatorDraftOperationSchema).min(1));

export const editCodeEvaluatorDraftInputSchema = z
  .preprocess(
    normalizeEditCodeEvaluatorDraftInput,
    z.object({
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
