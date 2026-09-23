import type { z } from "zod";

import type { openDatasetEvaluatorForEditInputSchema } from "./schemas";

export type OpenDatasetEvaluatorForEditInput = z.output<
  typeof openDatasetEvaluatorForEditInputSchema
>;
