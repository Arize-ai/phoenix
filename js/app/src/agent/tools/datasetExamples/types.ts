import type { z } from "zod";

import type {
  addDatasetExamplesInputSchema,
  deleteDatasetExamplesInputSchema,
  listDatasetExamplesInputSchema,
  patchDatasetExamplesInputSchema,
} from "./schemas";

export type AddDatasetExamplesInput = z.infer<
  typeof addDatasetExamplesInputSchema
>;

export type AddDatasetExamplesResult =
  | { ok: true; output: string }
  | { ok: false; error: string };

export type ListDatasetExamplesInput = z.infer<
  typeof listDatasetExamplesInputSchema
>;

export type DatasetExampleRow = {
  id: string;
  input: unknown;
  output: unknown;
  metadata: unknown;
};

export type ListDatasetExamplesOutput = {
  datasetName: string;
  /** Names of the dataset's splits, so the model knows what it can filter by. */
  availableSplits: string[];
  examples: DatasetExampleRow[];
  hasNextPage: boolean;
  /** Pass back as `after` to fetch the next page. */
  endCursor: string | null;
};

export type ListDatasetExamplesResult =
  | { ok: true; output: ListDatasetExamplesOutput }
  | { ok: false; error: string };

export type PatchDatasetExamplesInput = z.infer<
  typeof patchDatasetExamplesInputSchema
>;

export type DeleteDatasetExamplesInput = z.infer<
  typeof deleteDatasetExamplesInputSchema
>;
