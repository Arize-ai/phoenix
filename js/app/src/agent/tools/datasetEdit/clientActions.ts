import { getActiveContext } from "@phoenix/agent/context/selectors";
import { stageDatasetWriteOperation } from "@phoenix/agent/shared/pendingDatasetWrite";
import {
  deleteDatasetOperation,
  patchDatasetOperation,
} from "@phoenix/agent/uiOperations/operations/datasetWrites";
import type { UiOperationHandler } from "@phoenix/agent/uiOperations/types";
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
}): UiOperationHandler<PatchDatasetInput> {
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
 */
export function createDeleteDatasetClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UiOperationHandler<DeleteDatasetInput> {
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
      apply: () => commitDeleteDataset({ datasetId }),
      agentStore,
    });
  };
}
