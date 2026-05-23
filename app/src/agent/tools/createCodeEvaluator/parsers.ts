import { createCodeEvaluatorInputSchema } from "./schemas";
import type { CreateCodeEvaluatorInput } from "./types";

export function parseCreateCodeEvaluatorInput(
  input: unknown
): CreateCodeEvaluatorInput | null {
  return createCodeEvaluatorInputSchema.safeParse(input).data ?? null;
}
