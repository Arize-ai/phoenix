import type { z } from "zod";

import type { readDatasetEvaluatorDefinitionInputSchema } from "./schemas";

export type ReadDatasetEvaluatorDefinitionInput = z.output<
  typeof readDatasetEvaluatorDefinitionInputSchema
>;
