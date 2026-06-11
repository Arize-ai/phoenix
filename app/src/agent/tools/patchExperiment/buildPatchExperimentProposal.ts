import type {
  ExperimentSnapshot,
  PatchExperimentFieldDiff,
  PatchExperimentInput,
  PatchExperimentPayload,
} from "./types";

function stringifyMetadata(metadata: Record<string, unknown>): string {
  return JSON.stringify(metadata, null, 2);
}

/**
 * A proposed patch whose effective change set is non-empty, paired with the
 * before/after diff the approval card renders. `null` when the input would not
 * change any field relative to the current experiment.
 */
export type PatchExperimentProposal = {
  payload: PatchExperimentPayload;
  diff: PatchExperimentFieldDiff[];
};

/**
 * Reduces a parsed patch input against the current experiment snapshot into the
 * canonical payload (only the keys that actually change) plus the field-level
 * diff. Returns `null` when nothing would change so the caller can reject the
 * proposal before creating a pending record. A field is in scope only when the
 * input carries that key; a value equal to the current one is dropped so a
 * no-op key never reaches the mutation or the card.
 */
export function buildPatchExperimentProposal(
  input: PatchExperimentInput,
  snapshot: ExperimentSnapshot
): PatchExperimentProposal | null {
  const payload: PatchExperimentPayload = {};
  const diff: PatchExperimentFieldDiff[] = [];

  if (input.name !== undefined && input.name !== snapshot.name) {
    payload.name = input.name;
    diff.push({
      field: "name",
      previous: snapshot.name,
      next: input.name,
    });
  }

  if ("description" in input) {
    const nextDescription = input.description ?? null;
    if (nextDescription !== snapshot.description) {
      payload.description = nextDescription;
      diff.push({
        field: "description",
        previous: snapshot.description,
        next: nextDescription,
      });
    }
  }

  if (input.metadata !== undefined) {
    const previousMetadata = stringifyMetadata(snapshot.metadata);
    const nextMetadata = stringifyMetadata(input.metadata);
    if (nextMetadata !== previousMetadata) {
      payload.metadata = input.metadata;
      diff.push({
        field: "metadata",
        previous: previousMetadata,
        next: nextMetadata,
      });
    }
  }

  if (diff.length === 0) return null;
  return { payload, diff };
}
