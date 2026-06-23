import {
  patchExperimentActionContextSchema,
  patchExperimentInputSchema,
} from "./schemas";
import type {
  PatchExperimentActionContext,
  PatchExperimentInput,
} from "./types";

export function parsePatchExperimentInput(
  input: unknown
): PatchExperimentInput | null {
  return patchExperimentInputSchema.safeParse(input).data ?? null;
}

// Context (tool call, session, output callback) assembled by Phoenix, not the model.
export function parsePatchExperimentActionContext(
  input: unknown
): PatchExperimentActionContext | null {
  return patchExperimentActionContextSchema.safeParse(input).data ?? null;
}
