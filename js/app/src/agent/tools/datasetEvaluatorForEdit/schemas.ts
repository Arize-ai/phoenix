import { z } from "zod";

export const openDatasetEvaluatorForEditInputSchema = z
  .object({
    datasetEvaluatorId: z.string().min(1),
  })
  .strict();
