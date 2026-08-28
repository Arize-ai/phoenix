import type { z } from "zod";

import type {
  cancelPlaygroundRunInputSchema,
  runPlaygroundInputSchema,
} from "./schemas";

export type RunPlaygroundInput = z.output<typeof runPlaygroundInputSchema>;
export type CancelPlaygroundRunInput = z.output<
  typeof cancelPlaygroundRunInputSchema
>;
