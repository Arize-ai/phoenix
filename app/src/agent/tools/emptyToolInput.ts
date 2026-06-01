import { z } from "zod";

/**
 * Shared parser for semantically no-argument tools: coalesces `null`/`undefined`
 * to `{}`, accepts and ignores stray keys, and rejects non-objects so a
 * malformed call still surfaces as invalid input. Not a general permissive
 * parser — use it only where the tool takes no arguments.
 */
export const emptyToolInputSchema = z
  .preprocess(
    (input) => (input == null ? {} : input),
    z.object({}).passthrough()
  )
  .transform(() => ({}));

export type EmptyToolInput = z.output<typeof emptyToolInputSchema>;

export function parseEmptyToolInput(input: unknown): EmptyToolInput | null {
  return emptyToolInputSchema.safeParse(input).data ?? null;
}
