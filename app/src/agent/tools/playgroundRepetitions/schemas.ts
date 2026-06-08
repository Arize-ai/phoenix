import { z } from "zod";

export const setPlaygroundRepetitionsInputSchema = z
  .object({
    repetitions: z.number().int().min(1).max(30),
  })
  .strict();
