import type { z } from "zod";

import type { createCodeEvaluatorInputSchema } from "./schemas";

export type CreateCodeEvaluatorInput = z.output<
  typeof createCodeEvaluatorInputSchema
>;
