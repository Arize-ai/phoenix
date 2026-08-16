import { z } from "zod";

import { datasetExampleSchema } from "@phoenix/agent/shared/datasetExampleSchema";

// Must agree with the server-owned PARAMETERS (create_dataset.py): a required
// unique name, an optional description, and optional starting rows whose shape
// matches add_dataset_examples.
export const createDatasetInputSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  examples: z.array(datasetExampleSchema).optional(),
});
