import {
  LOAD_DATASET_NAVIGATION_CANCEL_ERROR,
  LOAD_DATASET_TOOL_NAME,
} from "./constants";
import type {
  BindPendingLoadDatasetOptions,
  PendingLoadDataset,
} from "./types";

export function bindPendingLoadDatasetActions({
  pendingLoad,
  resolveDatasetTarget,
  readSelectionRevision,
  applyDatasetSelection,
  addToolOutput,
  setPendingLoadDataset,
}: BindPendingLoadDatasetOptions): PendingLoadDataset {
  return {
    ...pendingLoad,
    accept: async ({ approvalSource = "user" } = {}) => {
      setPendingLoadDataset(pendingLoad.toolCallId, null);

      if (readSelectionRevision() !== pendingLoad.expectedRevision) {
        await addToolOutput({
          state: "output-error",
          tool: LOAD_DATASET_TOOL_NAME,
          toolCallId: pendingLoad.toolCallId,
          errorText:
            "The playground dataset selection changed after this load was proposed, so it can no longer be applied.",
        });
        return;
      }

      // Dataset or split may have been deleted since the proposal — re-resolve before writing ids.
      const resolution = await resolveDatasetTarget(pendingLoad.input);
      if (!resolution.ok) {
        await addToolOutput({
          state: "output-error",
          tool: LOAD_DATASET_TOOL_NAME,
          toolCallId: pendingLoad.toolCallId,
          errorText: resolution.error,
        });
        return;
      }
      const resolvedSplitId = resolution.output.splitId;
      const proposedSplitId = pendingLoad.snapshot.splitIds[0] ?? null;
      if (
        resolution.output.datasetId !== pendingLoad.snapshot.datasetId ||
        resolvedSplitId !== proposedSplitId
      ) {
        await addToolOutput({
          state: "output-error",
          tool: LOAD_DATASET_TOOL_NAME,
          toolCallId: pendingLoad.toolCallId,
          errorText:
            "The proposed dataset or split changed after this load was proposed, so it can no longer be applied.",
        });
        return;
      }

      applyDatasetSelection(pendingLoad.snapshot);

      await addToolOutput({
        state: "output-available",
        tool: LOAD_DATASET_TOOL_NAME,
        toolCallId: pendingLoad.toolCallId,
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
      });
    },
    reject: async () => {
      setPendingLoadDataset(pendingLoad.toolCallId, null);
      await addToolOutput({
        state: "output-available",
        tool: LOAD_DATASET_TOOL_NAME,
        toolCallId: pendingLoad.toolCallId,
        output: {
          status: "rejected",
          message: "User rejected the proposed dataset load.",
        },
      });
    },
    cancel: async () => {
      setPendingLoadDataset(pendingLoad.toolCallId, null);
      await addToolOutput({
        state: "output-error",
        tool: LOAD_DATASET_TOOL_NAME,
        toolCallId: pendingLoad.toolCallId,
        errorText: LOAD_DATASET_NAVIGATION_CANCEL_ERROR,
      });
    },
  };
}
