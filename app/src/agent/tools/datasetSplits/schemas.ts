import { z } from "zod";

// list_dataset_splits takes no input (the dataset comes from context).
export const listDatasetSplitsInputSchema = z.object({});

// list_splits pages through the instance-wide split vocabulary.
export const listSplitsInputSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  after: z.string().min(1).nullable().optional(),
});

// create_dataset_split: name required; optional description, color, seed rows.
export const createDatasetSplitInputSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  color: z.string().trim().min(1).nullable().optional(),
  exampleIds: z.array(z.string().min(1)).optional(),
});

// set_dataset_example_splits: assign example ids to existing splits by name.
export const setDatasetExampleSplitsInputSchema = z.object({
  exampleIds: z.array(z.string().min(1)).min(1),
  splitNames: z.array(z.string().trim().min(1)).min(1),
});

// patch_dataset_split: edit a split (found by current name); at least one of
// name/description/color must change.
export const patchDatasetSplitInputSchema = z
  .object({
    splitName: z.string().trim().min(1),
    name: z.string().trim().min(1).nullable().optional(),
    description: z.string().nullable().optional(),
    color: z.string().trim().min(1).nullable().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.color !== undefined,
    { message: "Provide at least one field to change." }
  );

// delete_dataset_splits: delete splits by name.
export const deleteDatasetSplitsInputSchema = z.object({
  splitNames: z.array(z.string().trim().min(1)).min(1),
});
