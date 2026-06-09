import { z } from "zod";

export const setPlaygroundExperimentRecordingInputSchema = z
  .object({
    recordExperiments: z.boolean(),
  })
  .strict();
