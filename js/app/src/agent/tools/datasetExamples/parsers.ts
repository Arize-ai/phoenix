import {
  addDatasetExamplesInputSchema,
  deleteDatasetExamplesInputSchema,
  listDatasetExamplesInputSchema,
  patchDatasetExamplesInputSchema,
} from "./schemas";
import type {
  AddDatasetExamplesInput,
  DeleteDatasetExamplesInput,
  ListDatasetExamplesInput,
  PatchDatasetExamplesInput,
} from "./types";

export function parseAddDatasetExamplesInput(
  input: unknown
): AddDatasetExamplesInput | null {
  return addDatasetExamplesInputSchema.safeParse(input).data ?? null;
}

export function parseListDatasetExamplesInput(
  input: unknown
): ListDatasetExamplesInput | null {
  return listDatasetExamplesInputSchema.safeParse(input).data ?? null;
}

export function parsePatchDatasetExamplesInput(
  input: unknown
): PatchDatasetExamplesInput | null {
  return patchDatasetExamplesInputSchema.safeParse(input).data ?? null;
}

export function parseDeleteDatasetExamplesInput(
  input: unknown
): DeleteDatasetExamplesInput | null {
  return deleteDatasetExamplesInputSchema.safeParse(input).data ?? null;
}
