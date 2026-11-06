import type { z } from "zod";

import type { listDatasetsInputSchema } from "./schemas";

export type ListDatasetsInput = z.infer<typeof listDatasetsInputSchema>;

export type DatasetSummary = {
  id: string;
  name: string;
  exampleCount: number;
};

export type ListDatasetsOutput = {
  datasets: DatasetSummary[];
  hasNextPage: boolean;
  endCursor: string | null;
};

export type ListDatasetsResult =
  | { ok: true; output: ListDatasetsOutput }
  | { ok: false; error: string };
