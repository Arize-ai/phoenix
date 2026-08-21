import { stageDatasetWriteOperation } from "@phoenix/agent/shared/pendingDatasetWrite";
import { createDatasetOperation } from "@phoenix/agent/uiOperations/operations/datasetWrites";
import type { UiOperationHandler } from "@phoenix/agent/uiOperations/types";
import type { AgentStore } from "@phoenix/store/agentStore";

import { commitCreateDataset } from "./createDataset";
import type { CreateDatasetInput } from "./types";

/**
 * Handler for the `dataset.create` operation: stages the create in the shared
 * dataset-approval card and resolves with the user's decision. The relocated
 * core of the retired `create_dataset` tool's execute path.
 */
export function createCreateDatasetClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UiOperationHandler<CreateDatasetInput> {
  return (input, context) =>
    stageDatasetWriteOperation({
      pending: {
        toolCallId: context.callId,
        toolName: createDatasetOperation.name,
        preview: {
          kind: "create",
          name: input.name,
          description: input.description,
          examples: input.examples,
        },
      },
      apply: () => commitCreateDataset(input),
      agentStore,
    });
}
