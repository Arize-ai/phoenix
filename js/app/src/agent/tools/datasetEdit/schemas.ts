import { z } from "zod";

// patch_dataset: at least one of name/description/metadata must be provided.
export const patchDatasetInputSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.metadata !== undefined,
    { message: "Provide at least one field to change." }
  );

// delete_dataset operates on the in-context dataset; no input.
export const deleteDatasetInputSchema = z.object({});
