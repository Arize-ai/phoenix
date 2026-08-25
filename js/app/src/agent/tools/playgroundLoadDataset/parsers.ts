import { loadDatasetInputSchema } from "./schemas";
import type { LoadDatasetInput } from "./types";

export function parseLoadDatasetInput(input: unknown): LoadDatasetInput | null {
  return loadDatasetInputSchema.safeParse(input).data ?? null;
}
