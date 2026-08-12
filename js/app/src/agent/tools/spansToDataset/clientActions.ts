import { getActiveContext } from "@phoenix/agent/context/selectors";
import { stageDatasetWriteOperation } from "@phoenix/agent/shared/pendingDatasetWrite";
import { addSpansToDatasetOperation } from "@phoenix/agent/uiOperations/operations/datasetWrites";
import type { UiOperationHandler } from "@phoenix/agent/uiOperations/types";
import type { AgentStore } from "@phoenix/store/agentStore";

import { commitAddSpansToDataset } from "./addSpansToDataset";
import { ADD_SPANS_TO_DATASET_NO_SPAN_ERROR } from "./constants";
import type { AddSpansToDatasetInput } from "./types";

/**
 * Handler for the `dataset.addSpans` operation. Spans are addressed by id:
 * explicit ids if given, else the span in view (from the advertised context).
 */
export function createAddSpansToDatasetClientAction({
  agentStore,
}: {
  agentStore: AgentStore;
}): UiOperationHandler<AddSpansToDatasetInput> {
  return async (input, context) => {
    let spanIds = input.spanIds ?? [];
    if (spanIds.length === 0) {
      const spanContext = getActiveContext(agentStore.getState(), "span");
      const spanNodeId = spanContext?.spanNodeId;
      if (!spanNodeId) {
        return { ok: false, error: ADD_SPANS_TO_DATASET_NO_SPAN_ERROR };
      }
      spanIds = [spanNodeId];
    }
    return stageDatasetWriteOperation({
      pending: {
        toolCallId: context.callId,
        toolName: addSpansToDatasetOperation.name,
        preview: {
          kind: "add-spans",
          datasetName: input.datasetName,
          spanCount: spanIds.length,
        },
      },
      apply: () =>
        commitAddSpansToDataset({ datasetName: input.datasetName, spanIds }),
      agentStore,
    });
  };
}
