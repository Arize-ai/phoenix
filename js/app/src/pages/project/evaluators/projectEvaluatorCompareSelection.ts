import z from "zod";

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

export function formatCompareSelection(selection: CompareSelection): string {
  return `matrix: ${selection.a} ∩ ${selection.b}`;
}
