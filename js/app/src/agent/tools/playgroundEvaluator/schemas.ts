import { z } from "zod";

import {
  CODE_EVALUATOR_LANGUAGES,
  EVALUATOR_OPTIMIZATION_DIRECTIONS,
} from "@phoenix/types";

const instanceIdSchema = z
  .number()
  .int()
  .optional()
  .describe(
    "The numeric playground instance to address. May be omitted when the " +
      "page has exactly one instance."
  );

const expectedRevisionSchema = z
  .string()
  .describe(
    "The `revision` from playground.evaluator.read, or from the previous " +
      "successful playground.evaluator.edit."
  );

const outputConfigNameSchema = z.string().trim().min(1);
const optimizationDirectionSchema = z.enum(EVALUATOR_OPTIMIZATION_DIRECTIONS);

// The read reports configs with a `kind`; a categorical config may also be
// written without one, as the judge's labels are the common case.
const categoricalOutputConfigSchema = z.strictObject({
  kind: z.literal("classification").optional(),
  name: outputConfigNameSchema,
  optimizationDirection: optimizationDirectionSchema,
  values: z
    .array(
      z.strictObject({
        label: z.string().min(1),
        score: z.number().nullish(),
      })
    )
    .min(2),
});

const continuousOutputConfigSchema = z.strictObject({
  kind: z.literal("continuous"),
  name: outputConfigNameSchema,
  optimizationDirection: optimizationDirectionSchema,
  lowerBound: z.number().nullish(),
  upperBound: z.number().nullish(),
});

const freeformOutputConfigSchema = z.strictObject({
  kind: z.literal("freeform"),
  name: outputConfigNameSchema,
  optimizationDirection: optimizationDirectionSchema,
  threshold: z.number().nullish(),
  lowerBound: z.number().nullish(),
  upperBound: z.number().nullish(),
});

/** One output of an evaluator task, as read and as written back. */
export const evaluatorTaskOutputConfigSchema = z.union([
  categoricalOutputConfigSchema,
  continuousOutputConfigSchema,
  freeformOutputConfigSchema,
]);

export type EvaluatorTaskOutputConfig = z.infer<
  typeof evaluatorTaskOutputConfigSchema
>;

export const evaluatorTaskInputMappingSchema = z.strictObject({
  pathMapping: z
    .record(z.string(), z.string())
    .describe("Evaluator variable → path into the dataset example."),
  literalMapping: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .describe("Evaluator variable → fixed value."),
});

export const readEvaluatorTaskInputSchema = z.strictObject({
  instanceId: instanceIdSchema,
});

export const editEvaluatorTaskInputSchema = z.strictObject({
  instanceId: instanceIdSchema,
  expectedRevision: expectedRevisionSchema,
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  inputMapping: evaluatorTaskInputMappingSchema.optional(),
  outputConfigs: z.array(evaluatorTaskOutputConfigSchema).min(1).optional(),
  includeExplanation: z
    .boolean()
    .optional()
    .describe("LLM evaluators only: whether the judge explains its label."),
  language: z
    .enum(CODE_EVALUATOR_LANGUAGES)
    .optional()
    .describe(
      "Code evaluators only; a saved code evaluator keeps its language."
    ),
  sourceCode: z.string().optional().describe("Code evaluators only."),
  sandboxConfigId: z
    .string()
    .optional()
    .describe(
      "Code evaluators only; one of the read's availableSandboxConfigs ids " +
        "matching the language."
    ),
});

export const saveEvaluatorTaskInputSchema = z.strictObject({
  instanceId: instanceIdSchema,
  expectedRevision: expectedRevisionSchema,
  asNew: z
    .boolean()
    .optional()
    .describe(
      "Save a copy instead: leaves the loaded evaluator unchanged and " +
        "creates a new dataset evaluator named after the task with a _copy " +
        'suffix (the Save dialog\'s "Save as new"). Ignored for a draft, ' +
        "which is created either way."
    ),
});

export const setExpectedOutputInputSchema = z.strictObject({
  instanceId: instanceIdSchema,
  exampleId: z.string().min(1).describe("The dataset example's node id."),
  expectedRevisionId: z
    .string()
    .min(1)
    .describe(
      "The example's current `revisionId`, from " +
        "playground.experiment.readResults."
    ),
  label: z
    .string()
    .nullable()
    .describe(
      "The expected label; one of the output's labels for a categorical " +
        "output. Null with no score or explanation clears the expected output."
    ),
  score: z.number().nullable().optional(),
  explanation: z.string().nullable().optional(),
});
