import { getActiveContext } from "@phoenix/agent/context/selectors";
import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";

import {
  DATASET_SPLITS_NO_DATASET_ERROR,
  LIST_DATASET_SPLITS_TOOL_NAME,
  LIST_SPLITS_TOOL_NAME,
} from "./constants";
import { commitListDatasetSplits } from "./listDatasetSplits";
import { commitListSplits } from "./listSplits";
import { parseListDatasetSplitsInput, parseListSplitsInput } from "./parsers";
import type { ListDatasetSplitsInput, ListSplitsInput } from "./types";

export const listDatasetSplitsAgentTool = defineTool<ListDatasetSplitsInput>({
  name: LIST_DATASET_SPLITS_TOOL_NAME,
  parseInput: parseListDatasetSplitsInput,
  invalidInputErrorText: `Invalid ${LIST_DATASET_SPLITS_TOOL_NAME} input. Expected {}.`,
  execute: async ({ toolCall, addToolOutput, agentStore }) => {
    const datasetContext = getActiveContext(agentStore.getState(), "dataset");
    if (!datasetContext) {
      await addToolOutput({
        state: "output-error",
        tool: LIST_DATASET_SPLITS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: DATASET_SPLITS_NO_DATASET_ERROR,
      });
      return;
    }
    const result = await commitListDatasetSplits({
      datasetId: datasetContext.datasetNodeId,
    });
    if (result.ok) {
      await addToolOutput({
        state: "output-available",
        tool: LIST_DATASET_SPLITS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        output: result.output,
      });
    } else {
      await addToolOutput({
        state: "output-error",
        tool: LIST_DATASET_SPLITS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: result.error,
      });
    }
  },
});

export const listSplitsAgentTool = defineTool<ListSplitsInput>({
  name: LIST_SPLITS_TOOL_NAME,
  parseInput: parseListSplitsInput,
  invalidInputErrorText: `Invalid ${LIST_SPLITS_TOOL_NAME} input. Expected { limit?: number, after?: string }.`,
  execute: async ({ toolCall, input, addToolOutput }) => {
    const result = await commitListSplits({
      limit: input.limit,
      after: input.after,
    });
    if (result.ok) {
      await addToolOutput({
        state: "output-available",
        tool: LIST_SPLITS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        output: result.output,
      });
    } else {
      await addToolOutput({
        state: "output-error",
        tool: LIST_SPLITS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: result.error,
      });
    }
  },
});
