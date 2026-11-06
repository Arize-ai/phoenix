import type {
  ExperimentSnapshot,
  PatchExperimentFieldDiff,
  PatchExperimentInput,
  PatchExperimentPayload,
} from "./types";

function stringifyMetadata(metadata: Record<string, unknown>): string {
  return JSON.stringify(metadata, null, 2);
}

export type PatchExperimentProposal = {
  payload: PatchExperimentPayload;
  diff: PatchExperimentFieldDiff[];
};

// Returns null when no field would change relative to the snapshot.
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
