import {
  createDatasetLabelInputSchema,
  deleteDatasetLabelsInputSchema,
  listDatasetLabelsInputSchema,
  listLabelsInputSchema,
  setDatasetLabelsInputSchema,
} from "./schemas";
import type {
  CreateDatasetLabelInput,
  DeleteDatasetLabelsInput,
  ListDatasetLabelsInput,
  ListLabelsInput,
  SetDatasetLabelsInput,
} from "./types";

export function parseListDatasetLabelsInput(
  input: unknown
): ListDatasetLabelsInput | null {
  return listDatasetLabelsInputSchema.safeParse(input).data ?? null;
}

export function parseListLabelsInput(input: unknown): ListLabelsInput | null {
  return listLabelsInputSchema.safeParse(input).data ?? null;
}

export function parseCreateDatasetLabelInput(
  input: unknown
): CreateDatasetLabelInput | null {
  return createDatasetLabelInputSchema.safeParse(input).data ?? null;
}

export function parseSetDatasetLabelsInput(
  input: unknown
): SetDatasetLabelsInput | null {
  return setDatasetLabelsInputSchema.safeParse(input).data ?? null;
}

export function parseDeleteDatasetLabelsInput(
  input: unknown
): DeleteDatasetLabelsInput | null {
  return deleteDatasetLabelsInputSchema.safeParse(input).data ?? null;
}
