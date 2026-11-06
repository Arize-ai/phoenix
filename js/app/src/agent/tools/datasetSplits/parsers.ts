import {
  createDatasetSplitInputSchema,
  deleteDatasetSplitsInputSchema,
  listDatasetSplitsInputSchema,
  listSplitsInputSchema,
  patchDatasetSplitInputSchema,
  setDatasetExampleSplitsInputSchema,
} from "./schemas";
import type {
  CreateDatasetSplitInput,
  DeleteDatasetSplitsInput,
  ListDatasetSplitsInput,
  ListSplitsInput,
  PatchDatasetSplitInput,
  SetDatasetExampleSplitsInput,
} from "./types";

export function parseListDatasetSplitsInput(
  input: unknown
): ListDatasetSplitsInput | null {
  return listDatasetSplitsInputSchema.safeParse(input).data ?? null;
}

export function parseListSplitsInput(input: unknown): ListSplitsInput | null {
  return listSplitsInputSchema.safeParse(input).data ?? null;
}

export function parseCreateDatasetSplitInput(
  input: unknown
): CreateDatasetSplitInput | null {
  return createDatasetSplitInputSchema.safeParse(input).data ?? null;
}

export function parseSetDatasetExampleSplitsInput(
  input: unknown
): SetDatasetExampleSplitsInput | null {
  return setDatasetExampleSplitsInputSchema.safeParse(input).data ?? null;
}

export function parsePatchDatasetSplitInput(
  input: unknown
): PatchDatasetSplitInput | null {
  return patchDatasetSplitInputSchema.safeParse(input).data ?? null;
}

export function parseDeleteDatasetSplitsInput(
  input: unknown
): DeleteDatasetSplitsInput | null {
  return deleteDatasetSplitsInputSchema.safeParse(input).data ?? null;
}
