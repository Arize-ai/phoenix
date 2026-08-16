import {
  loadDatasetActionContextSchema,
  loadDatasetInputSchema,
} from "./schemas";
import type { LoadDatasetActionContext, LoadDatasetInput } from "./types";

export function parseLoadDatasetInput(input: unknown): LoadDatasetInput | null {
  return loadDatasetInputSchema.safeParse(input).data ?? null;
}

export function parseLoadDatasetActionContext(
  context: unknown
): LoadDatasetActionContext | null {
  return loadDatasetActionContextSchema.safeParse(context).data ?? null;
}
