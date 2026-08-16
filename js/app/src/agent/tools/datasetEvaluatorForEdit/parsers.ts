import { openDatasetEvaluatorForEditInputSchema } from "./schemas";
import type { OpenDatasetEvaluatorForEditInput } from "./types";

export function parseOpenDatasetEvaluatorForEditInput(
  input: unknown
): OpenDatasetEvaluatorForEditInput | null {
  return openDatasetEvaluatorForEditInputSchema.safeParse(input).data ?? null;
}
