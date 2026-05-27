import { z } from "zod";

export const runPlaygroundInputSchema = z
  .preprocess(
    (input) => (input == null ? {} : input),
    z.object({}).strict()
  )
  .transform(() => ({}));
