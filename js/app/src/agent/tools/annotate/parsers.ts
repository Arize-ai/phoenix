import { annotateInputSchema } from "./schemas";
import type { AnnotateInput } from "./types";

/**
 * Parses the `annotate` tool input. Returns normalized data on success and
 * `null` when the payload is invalid so callers can ignore malformed calls
 * without handling Zod errors.
 */
export function parseAnnotateInput(input: unknown): AnnotateInput | null {
  return annotateInputSchema.safeParse(input).data ?? null;
}
