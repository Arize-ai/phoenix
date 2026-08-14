import { z } from "zod";

export const setDatasetEvaluatorSelectionInputSchema = z
  .object({
    datasetEvaluatorIds: z.array(z.string().min(1)),
  })
  .strict();
