import { readDatasetEvaluatorDefinitionInputSchema } from "./schemas";
import type { ReadDatasetEvaluatorDefinitionInput } from "./types";

export function parseReadDatasetEvaluatorDefinitionInput(
  input: unknown
): ReadDatasetEvaluatorDefinitionInput | null {
  return (
    readDatasetEvaluatorDefinitionInputSchema.safeParse(input).data ?? null
  );
}
