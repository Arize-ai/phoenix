import { bindPendingApproval } from "@phoenix/agent/shared/pendingApproval";

import { LOAD_DATASET_NAVIGATION_CANCEL_ERROR } from "./constants";
import type {
  BindPendingLoadDatasetOptions,
  PendingLoadDataset,
} from "./types";

/**
 * Attaches accept/reject/cancel callbacks to a pending dataset load. The
 * generic lifecycle lives in {@link bindPendingApproval}; the commit re-checks
 * that the playground selection and resolved target have not drifted since the
 * proposal, then writes the dataset/split ids.
 */
export function bindPendingLoadDatasetActions({
  pendingLoad,
  resolveDatasetTarget,
  readSelectionRevision,
  applyDatasetSelection,
  addToolOutput,
  clearPending,
}: BindPendingLoadDatasetOptions): PendingLoadDataset {
  return bindPendingApproval<PendingLoadDataset>({
    pending: pendingLoad,
    addToolOutput,
    clearPending,
    navigationCancelError: LOAD_DATASET_NAVIGATION_CANCEL_ERROR,
    commit: async ({ approvalSource }) => {
      if (readSelectionRevision() !== pendingLoad.expectedRevision) {
        return {
          ok: false,
          error:
            "The playground dataset selection changed after this load was proposed, so it can no longer be applied.",
        };
      }

      // Dataset or split may have been deleted since the proposal — re-resolve before writing ids.
      const resolution = await resolveDatasetTarget(pendingLoad.input);
      if (!resolution.ok) {
        return { ok: false, error: resolution.error };
      }
      const resolvedSplitId = resolution.output.splitId;
      const proposedSplitId = pendingLoad.snapshot.splitIds[0] ?? null;
      if (
        resolution.output.datasetId !== pendingLoad.snapshot.datasetId ||
        resolvedSplitId !== proposedSplitId
      ) {
        return {
          ok: false,
          error:
            "The proposed dataset or split changed after this load was proposed, so it can no longer be applied.",
        };
      }

      applyDatasetSelection(pendingLoad.snapshot);

      return {
        ok: true,
        output: {
          status: "loaded",
          acceptedBy: approvalSource,
          datasetId: pendingLoad.snapshot.datasetId,
          datasetName: pendingLoad.snapshot.datasetName ?? null,
          splitIds: pendingLoad.snapshot.splitIds,
          splitNames: pendingLoad.snapshot.splitNames ?? [],
          message:
            approvalSource === "auto"
              ? "Dataset load auto-approved."
              : "Playground switched to dataset mode.",
        },
      };
    },
    buildRejectedOutput: () => ({
      status: "rejected",
      message: "User rejected the proposed dataset load.",
    }),
  });
}
