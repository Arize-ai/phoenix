import {
  PATCH_EXPERIMENT_NAVIGATION_CANCEL_ERROR,
  PATCH_EXPERIMENT_STALE_TARGET_ERROR,
  PATCH_EXPERIMENT_TOOL_NAME,
} from "./constants";
import type {
  BindPendingPatchExperimentOptions,
  PatchExperimentFieldDiff,
  PendingPatchExperiment,
} from "./types";

/** Model-facing representation of the diff rendered on the approval card. */
function toChangeOutput(diff: PatchExperimentFieldDiff[]) {
  return diff.map((change) => ({
    field: change.field,
    previous: change.previous,
    new: change.next,
  }));
}

/** Attaches accept/reject callbacks to a pending experiment patch proposal. */
export function bindPendingPatchExperimentActions({
  pendingPatch,
  fetchExperimentSnapshot,
  commitPatchExperiment,
  addToolOutput,
  setPendingPatchExperiment,
}: BindPendingPatchExperimentOptions): PendingPatchExperiment {
  const { experimentId, experimentName, payload, diff } = pendingPatch;
  return {
    ...pendingPatch,
    accept: async ({ approvalSource = "user" } = {}) => {
      setPendingPatchExperiment(pendingPatch.toolCallId, null);

      let currentUpdatedAt: string;
      try {
        currentUpdatedAt = (await fetchExperimentSnapshot(experimentId))
          .updatedAt;
      } catch (error) {
        await addToolOutput({
          state: "output-error",
          tool: PATCH_EXPERIMENT_TOOL_NAME,
          toolCallId: pendingPatch.toolCallId,
          errorText:
            error instanceof Error
              ? error.message
              : "Failed to re-read the experiment before applying the edit.",
        });
        return;
      }

      // The staleness guard rejects only target drift; the payload is never
      // reconstructed from live state, so the committed write matches the card.
      if (currentUpdatedAt !== pendingPatch.expectedUpdatedAt) {
        await addToolOutput({
          state: "output-error",
          tool: PATCH_EXPERIMENT_TOOL_NAME,
          toolCallId: pendingPatch.toolCallId,
          errorText: PATCH_EXPERIMENT_STALE_TARGET_ERROR,
        });
        return;
      }

      try {
        await commitPatchExperiment({ experimentId, payload });
      } catch (error) {
        await addToolOutput({
          state: "output-error",
          tool: PATCH_EXPERIMENT_TOOL_NAME,
          toolCallId: pendingPatch.toolCallId,
          errorText:
            error instanceof Error
              ? error.message
              : "Failed to apply the experiment edit.",
        });
        return;
      }

      await addToolOutput({
        state: "output-available",
        tool: PATCH_EXPERIMENT_TOOL_NAME,
        toolCallId: pendingPatch.toolCallId,
        output: {
          status: "applied",
          acceptedBy: approvalSource,
          experimentId,
          experimentName,
          changes: toChangeOutput(diff),
          message:
            approvalSource === "auto"
              ? `Experiment "${experimentName}" edit auto-applied.`
              : `Experiment "${experimentName}" updated.`,
        },
      });
    },
    reject: async () => {
      setPendingPatchExperiment(pendingPatch.toolCallId, null);
      await addToolOutput({
        state: "output-available",
        tool: PATCH_EXPERIMENT_TOOL_NAME,
        toolCallId: pendingPatch.toolCallId,
        output: {
          status: "rejected",
          experimentId,
          experimentName,
          changes: toChangeOutput(diff),
          message: `User rejected the proposed edit to experiment "${experimentName}".`,
        },
      });
    },
    cancel: async () => {
      setPendingPatchExperiment(pendingPatch.toolCallId, null);
      await addToolOutput({
        state: "output-error",
        tool: PATCH_EXPERIMENT_TOOL_NAME,
        toolCallId: pendingPatch.toolCallId,
        errorText: PATCH_EXPERIMENT_NAVIGATION_CANCEL_ERROR,
      });
    },
  };
}
