import { z } from "zod";

export const setPlaygroundExperimentRecordingInputSchema = z
  .object({
    recordExperiments: z.boolean(),
    experimentName: z.string().optional(),
    experimentDescription: z.string().optional(),
    experimentMetadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
