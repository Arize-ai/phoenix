import { setPlaygroundRepetitionsInputSchema } from "./schemas";
import type { SetPlaygroundRepetitionsInput } from "./types";

export function parseSetPlaygroundRepetitionsInput(
  input: unknown
): SetPlaygroundRepetitionsInput | null {
  return setPlaygroundRepetitionsInputSchema.safeParse(input).data ?? null;
}
