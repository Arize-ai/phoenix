import { getActiveContext } from "@phoenix/agent/context/selectors";
import { stageDatasetWriteOperation } from "@phoenix/agent/shared/pendingDatasetWrite";
import {
  deleteDatasetOperation,
  patchDatasetOperation,
} from "@phoenix/agent/uiOperations/operations/datasetWrites";
import type { UIOperationHandler } from "@phoenix/agent/uiOperations/types";
import type { AgentStore } from "@phoenix/store/agentStore";

import { DATASET_EDIT_NO_DATASET_ERROR } from "./constants";
import { commitDeleteDataset, resolveDatasetName } from "./deleteDataset";
import { commitPatchDataset } from "./patchDataset";
import type { DeleteDatasetInput, PatchDatasetInput } from "./types";

/**
 * Handler for the `dataset.patch` operation: resolves the target from the
 * advertised dataset context (never from the model), then stages the edit in
 * the shared dataset-approval card.
 */
export function createPatchDatasetClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UIOperationHandler<PatchDatasetInput> {
  return async (input, context) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      return { ok: false, error: DATASET_EDIT_NO_DATASET_ERROR };
    }
    const datasetId = datasetContext.datasetNodeId;
    return stageDatasetWriteOperation({
      pending: {
        toolCallId: context.callId,
        toolName: patchDatasetOperation.name,
        preview: { kind: "patch-dataset", changes: { ...input } },
      },
      apply: () => commitPatchDataset({ datasetId, ...input }),
      agentStore,
    });
  };
}

/**
 * Handler for the `dataset.delete` operation: resolves the target from the
 * advertised dataset context, then stages the destructive delete (the card
 * carries the permanence warning) for the user's decision.
 *
 * The target is always the dataset the user is viewing, so a successful
 * delete leaves them on a page for a dataset that no longer exists.
 * `onDatasetDeleted` lets the registering surface navigate away (the UI's own
 * delete lives on the datasets list, which never has this problem).
 */
export function createDeleteDatasetClientAction({
  agentStore,
  onDatasetDeleted,
}: {
  agentStore: AgentStore;
  onDatasetDeleted?: (datasetId: string) => void;
}): UIOperationHandler<DeleteDatasetInput> {
  return async (_input, context) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      return { ok: false, error: DATASET_EDIT_NO_DATASET_ERROR };
    }
    const datasetId = datasetContext.datasetNodeId;
    const datasetName = (await resolveDatasetName(datasetId)) ?? datasetId;
    return stageDatasetWriteOperation({
      pending: {
        toolCallId: context.callId,
        toolName: deleteDatasetOperation.name,
        preview: { kind: "delete-dataset", datasetName },
      },
      apply: async () => {
        const result = await commitDeleteDataset({ datasetId });
        if (result.ok) {
          onDatasetDeleted?.(datasetId);
        }
        return result;
      },
      agentStore,
    });
  };
}
