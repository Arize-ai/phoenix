import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { z } from "zod";

import { normalizeAliases } from "@phoenix/agent/tools/playgroundPrompt";

export type CodeEvaluatorEditToolOutputSender =
  Chat<UIMessage>["addToolOutput"];

const codeEvaluatorLanguageSchema = z.enum(["PYTHON", "TYPESCRIPT"]);

const optimizationDirectionSchema = z.enum(["MINIMIZE", "MAXIMIZE", "NONE"]);
const outputConfigNameSchema = z.string().trim().min(1);

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
    expectedRevision: ["expected_revision", "revision"],
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
    typeof candidate.expectedRevision === "string" &&
    typeof candidate.type === "string"
  ) {
    const { expectedRevision: _expectedRevision, ...operation } = candidate;
    return { ...candidate, operations: [operation] };
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
]);

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
      outputConfigs: ["output_configs"],
    }),
  z.discriminatedUnion("type", [
    setSourceCodeOperationSchema,
    setLanguageOperationSchema,
    setSandboxConfigOperationSchema,
    setInputMappingOperationSchema,
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

export const createCodeEvaluatorActionContextSchema =
  editCodeEvaluatorDraftActionContextSchema;
