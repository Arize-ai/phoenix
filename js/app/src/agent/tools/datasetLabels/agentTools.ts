import { getActiveContext } from "@phoenix/agent/context/selectors";
import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";

import {
  DATASET_LABELS_NO_DATASET_ERROR,
  LIST_DATASET_LABELS_TOOL_NAME,
  LIST_LABELS_TOOL_NAME,
} from "./constants";
import { commitListDatasetLabels } from "./listDatasetLabels";
import { commitListLabels } from "./listLabels";
import { parseListDatasetLabelsInput, parseListLabelsInput } from "./parsers";
import type { ListDatasetLabelsInput, ListLabelsInput } from "./types";

export const listDatasetLabelsAgentTool = defineTool<ListDatasetLabelsInput>({
  name: LIST_DATASET_LABELS_TOOL_NAME,
  parseInput: parseListDatasetLabelsInput,
  invalidInputErrorText: `Invalid ${LIST_DATASET_LABELS_TOOL_NAME} input. Expected {}.`,
  execute: async ({ toolCall, addToolOutput, agentStore }) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      await addToolOutput({
        state: "output-error",
        tool: LIST_DATASET_LABELS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: DATASET_LABELS_NO_DATASET_ERROR,
      });
      return;
    }
    const result = await commitListDatasetLabels({
      datasetId: datasetContext.datasetNodeId,
    });
    if (result.ok) {
      await addToolOutput({
        state: "output-available",
        tool: LIST_DATASET_LABELS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        output: result.output,
      });
    } else {
      await addToolOutput({
        state: "output-error",
        tool: LIST_DATASET_LABELS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: result.error,
      });
    }
  },
});

export const listLabelsAgentTool = defineTool<ListLabelsInput>({
  name: LIST_LABELS_TOOL_NAME,
  parseInput: parseListLabelsInput,
  invalidInputErrorText: `Invalid ${LIST_LABELS_TOOL_NAME} input. Expected { limit?: number, after?: string }.`,
  execute: async ({ toolCall, input, addToolOutput }) => {
    const result = await commitListLabels({
      limit: input.limit,
      after: input.after,
    });
    if (result.ok) {
      await addToolOutput({
        state: "output-available",
        tool: LIST_LABELS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        output: result.output,
      });
    } else {
      await addToolOutput({
        state: "output-error",
        tool: LIST_LABELS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: result.error,
      });
    }
  },
});
