import { setVariableValuesInputSchema } from "./schemas";
import type { SetVariableValuesInput } from "./types";

export function parseSetVariableValuesInput(
  input: unknown
): SetVariableValuesInput | null {
  return setVariableValuesInputSchema.safeParse(input).data ?? null;
}
