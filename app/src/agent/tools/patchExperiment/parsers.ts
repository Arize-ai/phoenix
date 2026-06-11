import {
  patchExperimentActionContextSchema,
  patchExperimentInputSchema,
} from "./schemas";
import type {
  PatchExperimentActionContext,
  PatchExperimentInput,
} from "./types";

/**
 * Parses the `patch_experiment` tool input, returning normalized typed data on
 * success and `null` for invalid input so callers can ignore malformed
 * payloads without handling Zod errors. An empty effective patch (only
 * `experimentId`) parses successfully here; the propose handler rejects it
 * before creating a pending record.
 */
export function parsePatchExperimentInput(
  input: unknown
): PatchExperimentInput | null {
  return patchExperimentInputSchema.safeParse(input).data ?? null;
}

/**
 * Parses the runtime-only context (owning tool call, session, output callback)
 * assembled by Phoenix rather than the agent model.
 */
export function parsePatchExperimentActionContext(
  input: unknown
): PatchExperimentActionContext | null {
  return patchExperimentActionContextSchema.safeParse(input).data ?? null;
}
