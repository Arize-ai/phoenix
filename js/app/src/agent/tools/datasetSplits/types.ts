import type { z } from "zod";

import type {
  createDatasetSplitInputSchema,
  deleteDatasetSplitsInputSchema,
  listDatasetSplitsInputSchema,
  listSplitsInputSchema,
  patchDatasetSplitInputSchema,
  setDatasetExampleSplitsInputSchema,
} from "./schemas";

export type ListDatasetSplitsInput = z.infer<
  typeof listDatasetSplitsInputSchema
>;

export type ListSplitsInput = z.infer<typeof listSplitsInputSchema>;

export type CreateDatasetSplitInput = z.infer<
  typeof createDatasetSplitInputSchema
>;

export type SetDatasetExampleSplitsInput = z.infer<
  typeof setDatasetExampleSplitsInputSchema
>;

export type PatchDatasetSplitInput = z.infer<
  typeof patchDatasetSplitInputSchema
>;

export type DeleteDatasetSplitsInput = z.infer<
  typeof deleteDatasetSplitsInputSchema
>;

export type DatasetSplitSummary = {
  id: string;
  name: string;
  description: string | null;
  color: string;
};

export type ListDatasetSplitsResult =
  | { ok: true; output: { datasetName: string; splits: DatasetSplitSummary[] } }
  | { ok: false; error: string };

export type ListSplitsResult =
  | {
      ok: true;
      output: {
        /** A page of the instance-wide split vocabulary. */
        splits: DatasetSplitSummary[];
        /** True when more splits exist; pass `endCursor` as `after`. */
        hasNextPage: boolean;
        endCursor: string | null;
      };
    }
  | { ok: false; error: string };
