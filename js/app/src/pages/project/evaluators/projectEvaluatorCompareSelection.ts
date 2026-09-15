import { useSearchParams } from "react-router";
import z from "zod";

import { PROJECT_EVALUATOR_COMPARE_SELECTION_PARAM } from "@phoenix/constants/searchParams";

const compareSelectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("matrix"), a: z.string(), b: z.string() }),
  z
    .object({
      kind: z.literal("distribution"),
      side: z.enum(["a", "b"]),
      view: z.enum(["scores", "labels"]),
      label: z.string(),
      lowerBound: z.number().finite().nullish(),
      upperBound: z.number().finite().nullish(),
      score: z.number().finite().nullish(),
    })
    .refine(
      (selection) =>
        selection.view === "labels" ||
        selection.score != null ||
        (selection.lowerBound != null &&
          selection.upperBound != null &&
          selection.lowerBound < selection.upperBound)
    ),
  z.object({
    kind: z.literal("flag"),
    side: z.enum(["a", "b"]),
    flagged: z.boolean(),
  }),
]);

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
  function setSelection(
    next: CompareSelection | null,
    options?: { replace?: boolean }
  ) {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      if (next)
        params.set(
          PROJECT_EVALUATOR_COMPARE_SELECTION_PARAM,
          encodeCompareSelection(next)
        );
      else params.delete(PROJECT_EVALUATOR_COMPARE_SELECTION_PARAM);
      return params;
    }, options);
  }
  return { selection, setSelection };
}

export function formatCompareSelection({
  selection,
  evaluatorAName,
  evaluatorBName,
}: {
  selection: CompareSelection;
  evaluatorAName: string;
  evaluatorBName: string;
}): string {
  if (selection.kind === "matrix")
    return `matrix: ${selection.a} ∩ ${selection.b}`;
  const name = selection.side === "a" ? evaluatorAName : evaluatorBName;
  if (selection.kind === "flag")
    return `${name}: ${selection.flagged ? "flagged" : "not flagged"}`;
  return `${name}: ${selection.view === "scores" ? "score " : ""}${selection.label}`;
}
