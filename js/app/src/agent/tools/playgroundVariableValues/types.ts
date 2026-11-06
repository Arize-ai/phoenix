import type { z } from "zod";

import type { setVariableValuesInputSchema } from "./schemas";

export type SetVariableValuesInput = z.output<
  typeof setVariableValuesInputSchema
>;
