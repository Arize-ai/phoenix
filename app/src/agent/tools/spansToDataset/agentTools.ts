import { getActiveContext } from "@phoenix/agent/context/selectors";
import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";
import { stageDatasetWrite } from "@phoenix/agent/shared/pendingDatasetWrite";

import { commitAddSpansToDataset } from "./addSpansToDataset";
import {
  ADD_SPANS_TO_DATASET_NO_SPAN_ERROR,
  ADD_SPANS_TO_DATASET_TOOL_NAME,
} from "./constants";
import { parseAddSpansToDatasetInput } from "./parsers";
import type { AddSpansToDatasetInput } from "./types";

export const addSpansToDatasetAgentTool = defineTool<AddSpansToDatasetInput>({
  name: ADD_SPANS_TO_DATASET_TOOL_NAME,
  parseInput: parseAddSpansToDatasetInput,
  invalidInputErrorText: `Invalid ${ADD_SPANS_TO_DATASET_TOOL_NAME} input. Expected { datasetName: string, spanIds?: string[] }.`,
  uiBehavior: { autoOpen: true, scrollIntoViewOnMount: true },
  execute: async ({
    toolCall,
    input,
    sessionId,
    addToolOutput,
    agentStore,
  }) => {
    // Spans are addressed by id: explicit ids if given, else the span in view.
    let spanIds = input.spanIds ?? [];
    if (spanIds.length === 0) {
      const spanContext = getActiveContext(agentStore.getState(), "span");
      const spanNodeId = spanContext?.spanNodeId;
      if (!spanNodeId) {
        await addToolOutput({
          state: "output-error",
          tool: ADD_SPANS_TO_DATASET_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: ADD_SPANS_TO_DATASET_NO_SPAN_ERROR,
        });
        return;
      }
      spanIds = [spanNodeId];
    }
    await stageDatasetWrite({
      sessionId,
      pending: {
        toolCallId: toolCall.toolCallId,
        toolName: ADD_SPANS_TO_DATASET_TOOL_NAME,
        preview: {
          kind: "add-spans",
          datasetName: input.datasetName,
          spanCount: spanIds.length,
        },
      },
      apply: () =>
        commitAddSpansToDataset({ datasetName: input.datasetName, spanIds }),
      addToolOutput,
      agentStore,
    });
  },
});
