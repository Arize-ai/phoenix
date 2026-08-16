import { setDatasetEvaluatorSelectionInputSchema } from "./schemas";
import type { SetDatasetEvaluatorSelectionInput } from "./types";

export function parseSetDatasetEvaluatorSelectionInput(
  input: unknown
): SetDatasetEvaluatorSelectionInput | null {
  return setDatasetEvaluatorSelectionInputSchema.safeParse(input).data ?? null;
}
