import { z } from "zod";

import {
  datasetExampleSchema,
  jsonObjectSchema,
} from "@phoenix/agent/shared/datasetExampleSchema";

// Must agree with the server-owned PARAMETERS (add_dataset_examples.py):
// a non-empty `examples` array; each item has a required `input` object and
// optional `output` / `metadata` objects.
export const addDatasetExamplesInputSchema = z.object({
  examples: z.array(datasetExampleSchema).min(1),
});

// Must agree with the server-owned PARAMETERS (list_dataset_examples.py): an
// optional row limit, a pagination cursor, and optional split-name filters.
// The dataset to read comes from context, not the model.
export const listDatasetExamplesInputSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  after: z.string().min(1).nullable().optional(),
  splitNames: z.array(z.string().trim().min(1)).optional(),
});

// patch_dataset_examples: each patch targets a row by id and updates at least
// one of input/output/metadata. Duplicate exampleIds are rejected here (two
// patches for one row can't be merged) — the backend refuses them anyway, but
// only after the user has already approved the write.
export const patchDatasetExamplesInputSchema = z.object({
  patches: z
    .array(
      z
        .object({
          exampleId: z.string().min(1),
          input: jsonObjectSchema.optional(),
          output: jsonObjectSchema.optional(),
          metadata: jsonObjectSchema.optional(),
        })
        .refine(
          (patch) =>
            patch.input !== undefined ||
            patch.output !== undefined ||
            patch.metadata !== undefined,
          { message: "Each patch must change at least one field." }
        )
    )
    .min(1)
    .refine(
      (patches) =>
        new Set(patches.map((patch) => patch.exampleId)).size ===
        patches.length,
      { message: "Each exampleId may appear at most once." }
    ),
  versionDescription: z.string().nullable().optional(),
});

// delete_dataset_examples: remove rows by id. Duplicate ids are harmless
// repetition of the same intent, so they are deduplicated rather than
// rejected — the backend errors on a duplicated delete.
export const deleteDatasetExamplesInputSchema = z.object({
  exampleIds: z
    .array(z.string().min(1))
    .min(1)
    .transform((ids) => Array.from(new Set(ids))),
  versionDescription: z.string().nullable().optional(),
});
