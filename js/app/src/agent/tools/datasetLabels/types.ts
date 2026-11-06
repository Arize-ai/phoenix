import type { z } from "zod";

import type {
  createDatasetLabelInputSchema,
  deleteDatasetLabelsInputSchema,
  listDatasetLabelsInputSchema,
  listLabelsInputSchema,
  setDatasetLabelsInputSchema,
} from "./schemas";

export type ListDatasetLabelsInput = z.infer<
  typeof listDatasetLabelsInputSchema
>;

export type ListLabelsInput = z.infer<typeof listLabelsInputSchema>;

export type CreateDatasetLabelInput = z.infer<
  typeof createDatasetLabelInputSchema
>;

export type SetDatasetLabelsInput = z.infer<typeof setDatasetLabelsInputSchema>;

export type DeleteDatasetLabelsInput = z.infer<
  typeof deleteDatasetLabelsInputSchema
>;

export type DatasetLabelSummary = {
  id: string;
  name: string;
  description: string | null;
  color: string;
};

export type ListDatasetLabelsResult =
  | {
      ok: true;
      output: {
        datasetName: string;
        /** The labels applied to the in-view dataset (a bounded per-dataset set). */
        labels: DatasetLabelSummary[];
      };
    }
  | { ok: false; error: string };

export type ListLabelsResult =
  | {
      ok: true;
      output: {
        /** A page of the instance-wide label vocabulary. */
        labels: DatasetLabelSummary[];
        /** True when more labels exist; pass `endCursor` as `after`. */
        hasNextPage: boolean;
        endCursor: string | null;
      };
    }
  | { ok: false; error: string };
