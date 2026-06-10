import { addSpansToDatasetInputSchema } from "./schemas";
import type { AddSpansToDatasetInput } from "./types";

export function parseAddSpansToDatasetInput(
  input: unknown
): AddSpansToDatasetInput | null {
  return addSpansToDatasetInputSchema.safeParse(input).data ?? null;
}
