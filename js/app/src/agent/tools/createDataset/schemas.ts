import { z } from "zod";

import { datasetExampleSchema } from "@phoenix/agent/shared/datasetExampleSchema";

// The only schema for the `dataset.create` operation input: a required unique
// name, an optional description, and optional starting rows whose shape
// matches `dataset.examples.add`.
export const createDatasetInputSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  examples: z.array(datasetExampleSchema).optional(),
});
