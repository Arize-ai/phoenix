import type { UiOperationHandler } from "@phoenix/agent/uiOperations/types";
import type { AgentStore } from "@phoenix/store/agentStore";

import {
  commitPatchExperiment,
  fetchExperimentSnapshot,
} from "./applyPatchExperiment";
import { buildPatchExperimentProposal } from "./buildPatchExperimentProposal";
import { bindPendingPatchExperimentOperationActions } from "./pendingPatchExperiment";
import type { PatchExperimentInput } from "./types";

/**
 * Handler for the `experiment.patch` operation: reads the experiment, builds
 * the field diff (resolving the name from the fetched experiment, never from
 * model input), and parks the calling script on the staged approval. A
 * proposal that changes nothing resolves immediately with `no_change`.
 */
export function createPatchExperimentClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UiOperationHandler<PatchExperimentInput> {
  return async (input, context) => {
    let snapshot;
    try {
      snapshot = await fetchExperimentSnapshot(input.experimentId);
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to read the experiment to edit.",
      };
    }

    const proposal = buildPatchExperimentProposal(input, snapshot);
    if (proposal == null) {
      return {
        ok: true,
        output: {
          status: "no_change",
          experimentId: input.experimentId,
          experimentName: snapshot.name,
          message: `The proposed edit matches experiment "${snapshot.name}" as it already is; nothing to apply.`,
        },
      };
    }

    return new Promise((resolve) => {
      const pendingPatch = bindPendingPatchExperimentOperationActions({
        pendingPatch: {
          toolCallId: context.callId,
          sessionId: context.sessionId ?? "",
          experimentId: input.experimentId,
          experimentName: snapshot.name,
          expectedUpdatedAt: snapshot.updatedAt,
          payload: proposal.payload,
          diff: proposal.diff,
        },
        fetchExperimentSnapshot,
        commitPatchExperiment,
        emitResult: resolve,
        setPendingPatchExperiment:
          agentStore.getState().setPendingPatchExperiment,
      });

      if (agentStore.getState().permissions.edits === "bypass") {
        void pendingPatch.accept?.({ approvalSource: "auto" });
        return;
      }

      agentStore
        .getState()
        .setPendingPatchExperiment(context.callId, pendingPatch);
    });
  };
}
