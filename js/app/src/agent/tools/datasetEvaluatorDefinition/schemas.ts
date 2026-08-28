import { z } from "zod";

import { MAX_EVALUATOR_IDS } from "./constants";

export const readDatasetEvaluatorDefinitionInputSchema = z
  .object({
    datasetEvaluatorIds: z
      .array(z.string().min(1))
      .min(1)
      .max(MAX_EVALUATOR_IDS),
  })
  .strict();
