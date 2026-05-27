import { runPlaygroundInputSchema } from "./schemas";
import type { RunPlaygroundInput } from "./types";

export function parseRunPlaygroundInput(
  input: unknown
): RunPlaygroundInput | null {
  return runPlaygroundInputSchema.safeParse(input).data ?? null;
}
