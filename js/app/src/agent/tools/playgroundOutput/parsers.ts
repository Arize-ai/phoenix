import { readPlaygroundOutputInputSchema } from "./schemas";
import type { ReadPlaygroundOutputInput } from "./types";

export function parseReadPlaygroundOutputInput(
  input: unknown
): ReadPlaygroundOutputInput | null {
  return readPlaygroundOutputInputSchema.safeParse(input).data ?? null;
}
