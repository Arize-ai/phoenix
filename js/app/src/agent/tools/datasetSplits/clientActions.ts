import { getActiveContext } from "@phoenix/agent/context/selectors";
import { stageDatasetWriteOperation } from "@phoenix/agent/shared/pendingDatasetWrite";
import { verifyExamplesInDataset } from "@phoenix/agent/shared/verifyExamplesInDataset";
import {
  createDatasetSplitOperation,
  deleteDatasetSplitsOperation,
  patchDatasetSplitOperation,
  setDatasetExampleSplitsOperation,
} from "@phoenix/agent/uiOperations/operations/datasetSplits";
import type { UiOperationHandler } from "@phoenix/agent/uiOperations/types";
import type { AgentStore } from "@phoenix/store/agentStore";

import {
  DATASET_SPLITS_NO_DATASET_ERROR,
  DEFAULT_DATASET_SPLIT_COLOR,
} from "./constants";
import { commitCreateDatasetSplit } from "./createDatasetSplit";
import { commitDeleteDatasetSplits } from "./deleteDatasetSplits";
import { commitPatchDatasetSplit } from "./patchDatasetSplit";
import { commitSetDatasetExampleSplits } from "./setDatasetExampleSplits";
import type {
  CreateDatasetSplitInput,
  DeleteDatasetSplitsInput,
  PatchDatasetSplitInput,
  SetDatasetExampleSplitsInput,
} from "./types";

/** Handler for the `dataset.split.create` operation. */
export function createCreateDatasetSplitClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UiOperationHandler<CreateDatasetSplitInput> {
  return (input, context) =>
    stageDatasetWriteOperation({
      pending: {
        toolCallId: context.callId,
        toolName: createDatasetSplitOperation.name,
        preview: {
          kind: "create-split",
          name: input.name,
          description: input.description,
          color: input.color ?? DEFAULT_DATASET_SPLIT_COLOR,
          exampleCount: input.exampleIds?.length ?? 0,
        },
      },
      apply: () => commitCreateDatasetSplit(input),
      agentStore,
    });
}

/**
 * Handler for the `dataset.split.setExampleSplits` operation. Example ids are
 * checked against the dataset in view at staging time so a stale id fails
 * before the user is asked to approve and the preview can name the dataset;
 * the batch mutation re-enforces membership server-side at apply time.
 */
export function createSetDatasetExampleSplitsClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UiOperationHandler<SetDatasetExampleSplitsInput> {
  return async (input, context) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      return { ok: false, error: DATASET_SPLITS_NO_DATASET_ERROR };
    }
    const membership = await verifyExamplesInDataset({
      datasetId: datasetContext.datasetNodeId,
      exampleIds: input.exampleIds,
    });
    if (!membership.ok) {
      return membership;
    }
    return stageDatasetWriteOperation({
      pending: {
        toolCallId: context.callId,
        toolName: setDatasetExampleSplitsOperation.name,
        preview: {
          kind: "set-splits",
          datasetName: membership.datasetName,
          splitNames: input.splitNames,
          exampleIds: input.exampleIds,
        },
      },
      apply: () =>
        commitSetDatasetExampleSplits({
          datasetId: datasetContext.datasetNodeId,
          exampleIds: input.exampleIds,
          splitNames: input.splitNames,
        }),
      agentStore,
    });
  };
}

/** Handler for the `dataset.split.patch` operation. */
export function createPatchDatasetSplitClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UiOperationHandler<PatchDatasetSplitInput> {
  return async (input, context) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      return { ok: false, error: DATASET_SPLITS_NO_DATASET_ERROR };
    }
    const { splitName, ...changes } = input;
    return stageDatasetWriteOperation({
      pending: {
        toolCallId: context.callId,
        toolName: patchDatasetSplitOperation.name,
        preview: { kind: "patch-split", splitName, changes: { ...changes } },
      },
      apply: () => commitPatchDatasetSplit(input),
      agentStore,
    });
  };
}

/**
 * Handler for the `dataset.split.delete` operation: destructive — the shared
 * card carries the instance-wide permanence warning.
 */
export function createDeleteDatasetSplitsClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UiOperationHandler<DeleteDatasetSplitsInput> {
  return async (input, context) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      return { ok: false, error: DATASET_SPLITS_NO_DATASET_ERROR };
    }
    return stageDatasetWriteOperation({
      pending: {
        toolCallId: context.callId,
        toolName: deleteDatasetSplitsOperation.name,
        preview: { kind: "delete-splits", splitNames: input.splitNames },
      },
      apply: () => commitDeleteDatasetSplits({ splitNames: input.splitNames }),
      agentStore,
    });
  };
}
