import type { z } from "zod";

import type {
  deleteDatasetInputSchema,
  patchDatasetInputSchema,
} from "./schemas";

export type PatchDatasetInput = z.infer<typeof patchDatasetInputSchema>;
export type DeleteDatasetInput = z.infer<typeof deleteDatasetInputSchema>;
