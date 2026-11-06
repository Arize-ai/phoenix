import { deleteDatasetInputSchema, patchDatasetInputSchema } from "./schemas";
import type { DeleteDatasetInput, PatchDatasetInput } from "./types";

export function parsePatchDatasetInput(
  input: unknown
): PatchDatasetInput | null {
  return patchDatasetInputSchema.safeParse(input).data ?? null;
}

export function parseDeleteDatasetInput(
  input: unknown
): DeleteDatasetInput | null {
  return deleteDatasetInputSchema.safeParse(input).data ?? null;
}
