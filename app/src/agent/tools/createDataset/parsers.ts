import { createDatasetInputSchema } from "./schemas";
import type { CreateDatasetInput } from "./types";

export function parseCreateDatasetInput(
  input: unknown
): CreateDatasetInput | null {
  return createDatasetInputSchema.safeParse(input).data ?? null;
}
