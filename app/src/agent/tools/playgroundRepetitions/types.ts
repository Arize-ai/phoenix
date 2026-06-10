import type { z } from "zod";

import type { setPlaygroundRepetitionsInputSchema } from "./schemas";

export type SetPlaygroundRepetitionsInput = z.output<
  typeof setPlaygroundRepetitionsInputSchema
>;
