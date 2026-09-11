import { z } from "zod";

// list_dataset_splits takes no input (the dataset comes from context).
export const listDatasetSplitsInputSchema = z.object({});

// list_splits pages through the instance-wide split vocabulary.
export const listSplitsInputSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  after: z.string().min(1).nullable().optional(),
});

// `dataset.split.create`: name required; optional description, color, seed rows.
export const createDatasetSplitInputSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  color: z.string().trim().min(1).nullable().optional(),
  exampleIds: z.array(z.string().min(1)).optional(),
});

// `dataset.split.setExampleSplits`: assign example ids to existing splits by name.
// Duplicates are harmless repetition of the same intent, so both lists are
// deduplicated rather than rejected.
export const setDatasetExampleSplitsInputSchema = z.object({
  exampleIds: z
    .array(z.string().min(1))
    .min(1)
    .transform((ids) => Array.from(new Set(ids))),
  splitNames: z
    .array(z.string().trim().min(1))
    .min(1)
    .transform((names) => Array.from(new Set(names))),
});

// `dataset.split.patch`: edit a split (found by current name); at least one of
// name/description/color must change. `description: null` clears the
// description (the backend distinguishes omitted from null); name and color
// are not clearable, so null there is normalized to "omitted" — otherwise a
// null-only call would be approved and report success while changing nothing.
// Empty strings are rejected rather than written.
export const patchDatasetSplitInputSchema = z
  .object({
    splitName: z.string().trim().min(1),
    name: z.string().trim().min(1).nullish(),
    description: z.string().min(1).nullable().optional(),
    color: z.string().trim().min(1).nullish(),
  })
  .transform(({ splitName, name, description, color }) => ({
    splitName,
    ...(name != null ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(color != null ? { color } : {}),
  }))
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.color !== undefined,
    { message: "Provide at least one field to change." }
  );

// `dataset.split.delete`: delete splits by name.
export const deleteDatasetSplitsInputSchema = z.object({
  splitNames: z.array(z.string().trim().min(1)).min(1),
});
