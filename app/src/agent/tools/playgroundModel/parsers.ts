import { setPlaygroundModelInputSchema } from "./schemas";
import type { SetPlaygroundModelInput } from "./types";

export function parseSetPlaygroundModelInput(
  input: unknown
): SetPlaygroundModelInput | null {
  return setPlaygroundModelInputSchema.safeParse(input).data ?? null;
}
