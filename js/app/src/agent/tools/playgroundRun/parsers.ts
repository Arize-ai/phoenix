import {
  cancelPlaygroundRunInputSchema,
  runPlaygroundInputSchema,
} from "./schemas";
import type { CancelPlaygroundRunInput, RunPlaygroundInput } from "./types";

export function parseRunPlaygroundInput(
  input: unknown
): RunPlaygroundInput | null {
  return runPlaygroundInputSchema.safeParse(input).data ?? null;
}

export function parseCancelPlaygroundRunInput(
  input: unknown
): CancelPlaygroundRunInput | null {
  return cancelPlaygroundRunInputSchema.safeParse(input).data ?? null;
}
