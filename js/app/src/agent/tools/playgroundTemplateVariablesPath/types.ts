import type { z } from "zod";

import type { setTemplateVariablesPathInputSchema } from "./schemas";

export type SetTemplateVariablesPathInput = z.output<
  typeof setTemplateVariablesPathInputSchema
>;
