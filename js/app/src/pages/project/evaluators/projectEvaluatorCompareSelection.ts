import { useSearchParams } from "react-router";
import z from "zod";

import { PROJECT_EVALUATOR_COMPARE_SELECTION_PARAM } from "@phoenix/constants/searchParams";

// The matrix is the only selection source today. `kind` stays in the URL
// payload so other sources can be added later without invalidating links.
const compareSelectionSchema = z.object({
  kind: z.literal("matrix"),
  a: z.string(),
  b: z.string(),
});

export type CompareSelection = z.infer<typeof compareSelectionSchema>;

export function encodeCompareSelection(selection: CompareSelection): string {
  return JSON.stringify(selection);
}

export function parseCompareSelection(
  value: string | null
): CompareSelection | null {
  if (!value) return null;
  try {
    const result = compareSelectionSchema.safeParse(JSON.parse(value));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function useCompareSelection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selection = parseCompareSelection(
    searchParams.get(PROJECT_EVALUATOR_COMPARE_SELECTION_PARAM)
  );
  /**
   * The router commits navigations inside a React transition, which would hold
   * every consumer of the selection, the matrix highlight included, until the
   * targets table's next query resolved. Flushing the update synchronously
   * instead lets the matrix and heading respond at once while the table defers
   * its condition and keeps the current rows on screen. Pass `flushSync: false`
   * from an effect, where a synchronous flush is not allowed.
   */
  function setSelection(
    next: CompareSelection | null,
    options?: { replace?: boolean; flushSync?: boolean }
  ) {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        if (next)
          params.set(
            PROJECT_EVALUATOR_COMPARE_SELECTION_PARAM,
            encodeCompareSelection(next)
          );
        else params.delete(PROJECT_EVALUATOR_COMPARE_SELECTION_PARAM);
        return params;
      },
      { flushSync: true, ...options }
    );
  }
  return { selection, setSelection };
}

export function formatCompareSelection(selection: CompareSelection): string {
  return `matrix: ${selection.a} ∩ ${selection.b}`;
}
