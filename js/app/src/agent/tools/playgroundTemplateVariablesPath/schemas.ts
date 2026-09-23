import { z } from "zod";

export const setTemplateVariablesPathInputSchema = z
  .object({
    path: z.string().nullable(),
  })
  .strict();
