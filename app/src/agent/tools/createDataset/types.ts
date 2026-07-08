import type { z } from "zod";

import type { createDatasetInputSchema } from "./schemas";

export type CreateDatasetInput = z.infer<typeof createDatasetInputSchema>;

export type CreateDatasetResult =
  | { ok: true; output: string }
  | { ok: false; error: string };
