import { z } from "zod";

export const readPlaygroundOutputInputSchema = z
  .preprocess(
    (input) => (input == null ? {} : input),
    z
      .object({
        instanceId: z.number().int().optional(),
        repetitionNumber: z.number().int().min(1).optional(),
      })
      .strict()
  )
  .transform(({ instanceId, repetitionNumber }) => ({
    ...(typeof instanceId === "number" ? { instanceId } : {}),
    ...(typeof repetitionNumber === "number" ? { repetitionNumber } : {}),
  }));
