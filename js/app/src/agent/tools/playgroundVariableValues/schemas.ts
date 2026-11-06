import { z } from "zod";

export const setVariableValuesInputSchema = z
  .object({
    values: z
      .array(z.object({ key: z.string().min(1), value: z.string() }).strict())
      .min(1),
  })
  .strict();
