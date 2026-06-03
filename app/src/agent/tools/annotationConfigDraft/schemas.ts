import { z } from "zod";

import { emptyToolInputSchema } from "@phoenix/agent/tools/emptyToolInput";
import { normalizeAliases } from "@phoenix/agent/tools/playgroundPrompt";

// The Python tool schema (agents/tools/*) is the model-facing source of truth
// for these enums; this TS layer only validates what the client dispatches.
const annotationTypeSchema = z.enum(["CATEGORICAL", "CONTINUOUS", "FREEFORM"]);
const optimizationDirectionSchema = z.enum(["MAXIMIZE", "MINIMIZE", "NONE"]);

const categoricalValueSchema = z.object({
  label: z.string(),
  score: z
    .number()
    .nullish()
    .transform((value) => value ?? null),
});

export const readAnnotationConfigDraftInputSchema = emptyToolInputSchema;

// `open_annotation_config_form` takes an optional config id: omitted/null opens
// the create form; a node id opens that existing config for editing. Coalesces
// a missing payload to `{}` like the empty-input parser, but keeps the id.
export const openAnnotationConfigFormInputSchema = z
  .preprocess(
    (input) =>
      normalizeAliases(input == null ? {} : input, {
        annotationConfigId: ["annotation_config_id"],
      }),
    z
      .object({
        annotationConfigId: z
          .string()
          .nullish()
          .transform((value) => value ?? null),
      })
      .passthrough()
  )
  .transform((input) => ({ annotationConfigId: input.annotationConfigId }));

const setNameOperationSchema = z.object({
  type: z.literal("set_name"),
  name: z.string(),
});

const setDescriptionOperationSchema = z.object({
  type: z.literal("set_description"),
  description: z.string().nullable(),
});

const setAnnotationTypeOperationSchema = z.object({
  type: z.literal("set_annotation_type"),
  annotationType: annotationTypeSchema,
});

const setOptimizationDirectionOperationSchema = z.object({
  type: z.literal("set_optimization_direction"),
  optimizationDirection: optimizationDirectionSchema,
});

const setLowerBoundOperationSchema = z.object({
  type: z.literal("set_lower_bound"),
  lowerBound: z.number().nullable(),
});

const setUpperBoundOperationSchema = z.object({
  type: z.literal("set_upper_bound"),
  upperBound: z.number().nullable(),
});

const setValuesOperationSchema = z.object({
  type: z.literal("set_values"),
  values: z.array(categoricalValueSchema),
});

export const editAnnotationConfigDraftOperationSchema = z.preprocess(
  (input) =>
    normalizeAliases(input, {
      annotationType: ["annotation_type"],
      optimizationDirection: ["optimization_direction"],
      lowerBound: ["lower_bound"],
      upperBound: ["upper_bound"],
    }),
  z.discriminatedUnion("type", [
    setNameOperationSchema,
    setDescriptionOperationSchema,
    setAnnotationTypeOperationSchema,
    setOptimizationDirectionOperationSchema,
    setLowerBoundOperationSchema,
    setUpperBoundOperationSchema,
    setValuesOperationSchema,
  ])
);

// The `normalize*` helpers map the model's snake_case keys and a single bare
// operation onto the canonical `{ operations: [...] }` shape these schemas
// expect (see normalizeAliases).
function normalizeEditAnnotationConfigDraftInput(input: unknown): unknown {
  const normalized = normalizeAliases(input, { operations: ["operation"] });
  if (
    typeof normalized !== "object" ||
    normalized === null ||
    Array.isArray(normalized)
  ) {
    return normalized;
  }
  const candidate = normalized as Record<string, unknown>;
  if (candidate.operations === undefined && typeof candidate.type === "string") {
    return { operations: [candidate] };
  }
  return normalized;
}

const editAnnotationConfigDraftOperationsSchema = z.preprocess((input) => {
  if (Array.isArray(input)) return input;
  return typeof input === "object" && input !== null ? [input] : input;
}, z.array(editAnnotationConfigDraftOperationSchema).min(1));

export const editAnnotationConfigDraftInputSchema = z
  .preprocess(
    normalizeEditAnnotationConfigDraftInput,
    z.object({
      operations: editAnnotationConfigDraftOperationsSchema,
    })
  )
  .transform((input) => input);
