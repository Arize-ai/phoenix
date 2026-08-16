import { z } from "zod";

/** A free-form JSON object (dataset example input / output / metadata payloads). */
export const jsonObjectSchema = z.record(z.string(), z.unknown());

/**
 * The shape of one dataset example as supplied by the model: a required `input`
 * object and optional `output` / `metadata` objects. Shared by `create_dataset`
 * (starting rows) and `add_dataset_examples` so their row shape can't drift.
 */
export const datasetExampleSchema = z.object({
  input: jsonObjectSchema,
  output: jsonObjectSchema.optional(),
  metadata: jsonObjectSchema.optional(),
});
