import { z } from "zod";

import {
  NUM_MAX_PLAYGROUND_REPETITIONS,
  NUM_MIN_PLAYGROUND_REPETITIONS,
} from "@phoenix/pages/playground/constants";

export const setPlaygroundRepetitionsInputSchema = z
  .object({
    repetitions: z
      .number()
      .int()
      .min(NUM_MIN_PLAYGROUND_REPETITIONS)
      .max(NUM_MAX_PLAYGROUND_REPETITIONS),
  })
  .strict();
