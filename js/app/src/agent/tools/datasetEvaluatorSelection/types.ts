import type { z } from "zod";

import type { setDatasetEvaluatorSelectionInputSchema } from "./schemas";

export type SetDatasetEvaluatorSelectionInput = z.output<
  typeof setDatasetEvaluatorSelectionInputSchema
>;
