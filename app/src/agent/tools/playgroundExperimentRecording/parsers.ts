import { setPlaygroundExperimentRecordingInputSchema } from "./schemas";
import type { SetPlaygroundExperimentRecordingInput } from "./types";

export function parseSetPlaygroundExperimentRecordingInput(
  input: unknown
): SetPlaygroundExperimentRecordingInput | null {
  return (
    setPlaygroundExperimentRecordingInputSchema.safeParse(input).data ?? null
  );
}
