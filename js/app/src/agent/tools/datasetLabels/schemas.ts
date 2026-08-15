import { z } from "zod";

// list_dataset_labels lists the in-view dataset's own labels — no input.
export const listDatasetLabelsInputSchema = z.object({});

// list_labels pages through the instance-wide label vocabulary.
export const listLabelsInputSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  after: z.string().min(1).nullable().optional(),
});

// create_dataset_label: name required; optional description/color; attaches to
// the in-context dataset by default.
export const createDatasetLabelInputSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  color: z.string().trim().min(1).nullable().optional(),
  attachToDataset: z.boolean().optional(),
});

// set_dataset_labels: set the dataset's labels to these existing label names.
export const setDatasetLabelsInputSchema = z.object({
  labelNames: z.array(z.string().trim().min(1)).min(1),
});

// delete_dataset_labels: delete labels by name (instance-wide).
export const deleteDatasetLabelsInputSchema = z.object({
  labelNames: z.array(z.string().trim().min(1)).min(1),
});
