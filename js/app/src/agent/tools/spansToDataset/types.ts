import type { z } from "zod";

import type { addSpansToDatasetInputSchema } from "./schemas";

export type AddSpansToDatasetInput = z.infer<
  typeof addSpansToDatasetInputSchema
>;
