import type { z } from "zod";

import type { setPlaygroundExperimentRecordingInputSchema } from "./schemas";

export type SetPlaygroundExperimentRecordingInput = z.output<
  typeof setPlaygroundExperimentRecordingInputSchema
>;
