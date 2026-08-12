import { getActiveContext } from "@phoenix/agent/context/selectors";
import { stageDatasetWriteOperation } from "@phoenix/agent/shared/pendingDatasetWrite";
import {
  createDatasetLabelOperation,
  deleteDatasetLabelsOperation,
  setDatasetLabelsOperation,
} from "@phoenix/agent/uiOperations/operations/datasetLabels";
import type { UiOperationHandler } from "@phoenix/agent/uiOperations/types";
import type { AgentStore } from "@phoenix/store/agentStore";

import {
  DATASET_LABELS_NO_DATASET_ERROR,
  DEFAULT_DATASET_LABEL_COLOR,
} from "./constants";
import { commitCreateDatasetLabel } from "./createDatasetLabel";
import { commitDeleteDatasetLabels } from "./deleteDatasetLabels";
import { commitSetDatasetLabels } from "./setDatasetLabels";
import type {
  CreateDatasetLabelInput,
  DeleteDatasetLabelsInput,
  SetDatasetLabelsInput,
} from "./types";

/** Handler for the `dataset.label.create` operation. */
export function createCreateDatasetLabelClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UiOperationHandler<CreateDatasetLabelInput> {
  return async (input, context) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      return { ok: false, error: DATASET_LABELS_NO_DATASET_ERROR };
    }
    const datasetId = datasetContext.datasetNodeId;
    return stageDatasetWriteOperation({
      pending: {
        toolCallId: context.callId,
        toolName: createDatasetLabelOperation.name,
        preview: {
          kind: "create-label",
          name: input.name,
          description: input.description,
          color: input.color ?? DEFAULT_DATASET_LABEL_COLOR,
          attachToDataset: input.attachToDataset !== false,
        },
      },
      apply: () => commitCreateDatasetLabel({ datasetId, ...input }),
      agentStore,
    });
  };
}

/** Handler for the `dataset.label.set` operation. */
export function createSetDatasetLabelsClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UiOperationHandler<SetDatasetLabelsInput> {
  return async (input, context) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      return { ok: false, error: DATASET_LABELS_NO_DATASET_ERROR };
    }
    const datasetId = datasetContext.datasetNodeId;
    return stageDatasetWriteOperation({
      pending: {
        toolCallId: context.callId,
        toolName: setDatasetLabelsOperation.name,
        preview: { kind: "set-labels", labelNames: input.labelNames },
      },
      apply: () =>
        commitSetDatasetLabels({ datasetId, labelNames: input.labelNames }),
      agentStore,
    });
  };
}

/**
 * Handler for the `dataset.label.delete` operation: destructive — the shared
 * card carries the instance-wide permanence warning.
 */
export function createDeleteDatasetLabelsClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UiOperationHandler<DeleteDatasetLabelsInput> {
  return async (input, context) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      return { ok: false, error: DATASET_LABELS_NO_DATASET_ERROR };
    }
    return stageDatasetWriteOperation({
      pending: {
        toolCallId: context.callId,
        toolName: deleteDatasetLabelsOperation.name,
        preview: { kind: "delete-labels", labelNames: input.labelNames },
      },
      apply: () => commitDeleteDatasetLabels({ labelNames: input.labelNames }),
      agentStore,
    });
  };
}
