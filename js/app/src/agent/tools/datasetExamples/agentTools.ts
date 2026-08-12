import { getActiveContext } from "@phoenix/agent/context/selectors";
import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";

import {
  LIST_DATASET_EXAMPLES_NO_DATASET_ERROR,
  LIST_DATASET_EXAMPLES_TOOL_NAME,
} from "./constants";
import { commitListDatasetExamples } from "./listDatasetExamples";
import { parseListDatasetExamplesInput } from "./parsers";
import type { ListDatasetExamplesInput } from "./types";

export const listDatasetExamplesAgentTool =
  defineTool<ListDatasetExamplesInput>({
    name: LIST_DATASET_EXAMPLES_TOOL_NAME,
    parseInput: parseListDatasetExamplesInput,
    invalidInputErrorText: `Invalid ${LIST_DATASET_EXAMPLES_TOOL_NAME} input. Expected { limit?: number, after?: string, splitNames?: string[] }.`,
    execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
      const datasetContext = getActiveContext(agentStore.getState(), "dataset");
      if (!datasetContext) {
        await addToolOutput({
          state: "output-error",
          tool: LIST_DATASET_EXAMPLES_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: LIST_DATASET_EXAMPLES_NO_DATASET_ERROR,
        });
        return;
      }
      const result = await commitListDatasetExamples({
        datasetId: datasetContext.datasetNodeId,
        limit: input.limit,
        after: input.after,
        splitNames: input.splitNames,
      });
      if (result.ok) {
        await addToolOutput({
          state: "output-available",
          tool: LIST_DATASET_EXAMPLES_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          output: result.output,
        });
      } else {
        await addToolOutput({
          state: "output-error",
          tool: LIST_DATASET_EXAMPLES_TOOL_NAME,
          toolCallId: toolCall.toolCallId,
          errorText: result.error,
        });
      }
    },
  });
