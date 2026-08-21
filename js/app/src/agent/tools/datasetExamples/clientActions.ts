import { getActiveContext } from "@phoenix/agent/context/selectors";
import { stageDatasetWriteOperation } from "@phoenix/agent/shared/pendingDatasetWrite";
import { verifyExamplesInDataset } from "@phoenix/agent/shared/verifyExamplesInDataset";
import {
  addDatasetExamplesOperation,
  deleteDatasetExamplesOperation,
  patchDatasetExamplesOperation,
} from "@phoenix/agent/uiOperations/operations/datasetWrites";
import type { UiOperationHandler } from "@phoenix/agent/uiOperations/types";
import type { AgentStore } from "@phoenix/store/agentStore";

import { commitAddDatasetExamples } from "./addDatasetExamples";
import {
  ADD_DATASET_EXAMPLES_NO_DATASET_ERROR,
  DELETE_DATASET_EXAMPLES_NO_DATASET_ERROR,
  PATCH_DATASET_EXAMPLES_NO_DATASET_ERROR,
} from "./constants";
import { commitDeleteDatasetExamples } from "./deleteDatasetExamples";
import { commitPatchDatasetExamples } from "./patchDatasetExamples";
import type {
  AddDatasetExamplesInput,
  DeleteDatasetExamplesInput,
  PatchDatasetExamplesInput,
} from "./types";

/**
 * Handler for the `dataset.examples.add` operation: appends rows to the
 * dataset resolved from the advertised context, behind the shared
 * dataset-approval card.
 */
export function createAddDatasetExamplesClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UiOperationHandler<AddDatasetExamplesInput> {
  return async (input, context) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      return { ok: false, error: ADD_DATASET_EXAMPLES_NO_DATASET_ERROR };
    }
    const datasetId = datasetContext.datasetNodeId;
    return stageDatasetWriteOperation({
      pending: {
        toolCallId: context.callId,
        toolName: addDatasetExamplesOperation.name,
        preview: { kind: "add", examples: input.examples },
      },
      apply: () =>
        commitAddDatasetExamples({ datasetId, examples: input.examples }),
      agentStore,
    });
  };
}

/**
 * Handler for the `dataset.examples.patch` operation. Example ids are global,
 * so each one is confirmed to be a row of the dataset in view before the
 * approval is staged — a stale id must not edit another dataset behind an
 * approval that doesn't name it.
 */
export function createPatchDatasetExamplesClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UiOperationHandler<PatchDatasetExamplesInput> {
  return async (input, context) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      return { ok: false, error: PATCH_DATASET_EXAMPLES_NO_DATASET_ERROR };
    }
    const membership = await verifyExamplesInDataset({
      datasetId: datasetContext.datasetNodeId,
      exampleIds: input.patches.map((patch) => patch.exampleId),
    });
    if (!membership.ok) {
      return membership;
    }
    return stageDatasetWriteOperation({
      pending: {
        toolCallId: context.callId,
        toolName: patchDatasetExamplesOperation.name,
        preview: {
          kind: "patch-examples",
          datasetName: membership.datasetName,
          patches: input.patches,
        },
      },
      apply: () =>
        commitPatchDatasetExamples({
          datasetId: datasetContext.datasetNodeId,
          ...input,
        }),
      agentStore,
    });
  };
}

/**
 * Handler for the `dataset.examples.delete` operation. Same global-id hazard
 * as patching, but destructive: never stage a delete whose rows aren't all in
 * the dataset in view.
 */
export function createDeleteDatasetExamplesClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UiOperationHandler<DeleteDatasetExamplesInput> {
  return async (input, context) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      return { ok: false, error: DELETE_DATASET_EXAMPLES_NO_DATASET_ERROR };
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
        toolName: deleteDatasetExamplesOperation.name,
        preview: {
          kind: "delete-examples",
          datasetName: membership.datasetName,
          exampleIds: input.exampleIds,
        },
      },
      apply: () =>
        commitDeleteDatasetExamples({
          datasetId: datasetContext.datasetNodeId,
          ...input,
        }),
      agentStore,
    });
  };
}
