import { z } from "zod";

const instanceIdSchema = z
  .number()
  .int()
  .optional()
  .describe(
    "The numeric playground instance to address. May be omitted when the " +
      "page has exactly one instance."
  );

const newTaskSourceSchema = z.strictObject({
  type: z.literal("new"),
  kind: z
    .enum(["prompt", "LLM", "CODE"])
    .describe(
      'What the fresh draft is: "prompt" for a prompt task, "LLM" or "CODE" ' +
        "for an evaluator task of that kind."
    ),
});

const promptTaskSourceSchema = z.strictObject({
  type: z.literal("prompt"),
  promptId: z.string().min(1).describe("The saved prompt's node id."),
  promptVersionId: z
    .string()
    .nullish()
    .describe("A specific version to load; the latest when omitted."),
  tagName: z
    .string()
    .nullish()
    .describe("Load the version carrying this tag instead of a version id."),
});

const evaluatorTaskSourceSchema = z.strictObject({
  type: z.literal("evaluator"),
  evaluatorId: z
    .string()
    .min(1)
    .describe("A saved LLM or code evaluator's node id (not a built-in)."),
});

const datasetEvaluatorTaskSourceSchema = z.strictObject({
  type: z.literal("datasetEvaluator"),
  datasetEvaluatorId: z
    .string()
    .min(1)
    .describe("The node id of an evaluator bound to a dataset."),
});

/**
 * Where a task comes from: a fresh draft, or a saved prompt or evaluator
 * that the page fetches into the instance. Mirrors the store's
 * `PlaygroundInstanceSource` minus `duplicate`, which only `instance.add`
 * accepts.
 */
export const taskSourceSchema = z.discriminatedUnion("type", [
  newTaskSourceSchema,
  promptTaskSourceSchema,
  evaluatorTaskSourceSchema,
  datasetEvaluatorTaskSourceSchema,
]);

export type TaskSource = z.infer<typeof taskSourceSchema>;

export const selectTaskInputSchema = z.strictObject({
  instanceId: instanceIdSchema,
  source: taskSourceSchema.describe("The task the instance becomes."),
  discardChanges: z
    .boolean()
    .default(false)
    .describe(
      "Required (true) to replace an instance that has unsaved changes. " +
        "Loading another prompt into a prompt task never needs it."
    ),
});

export type SelectTaskInput = z.infer<typeof selectTaskInputSchema>;
