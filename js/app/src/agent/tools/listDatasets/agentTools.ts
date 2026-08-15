import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";

import { LIST_DATASETS_TOOL_NAME } from "./constants";
import { commitListDatasets } from "./listDatasets";
import { parseListDatasetsInput } from "./parsers";
import type { ListDatasetsInput } from "./types";

export const listDatasetsAgentTool = defineTool<ListDatasetsInput>({
  name: LIST_DATASETS_TOOL_NAME,
  parseInput: parseListDatasetsInput,
  invalidInputErrorText: `Invalid ${LIST_DATASETS_TOOL_NAME} input. Expected { nameContains?: string, limit?: number, after?: string }.`,
  execute: async ({ toolCall, input, addToolOutput }) => {
    const result = await commitListDatasets(input);
    if (result.ok) {
      await addToolOutput({
        state: "output-available",
        tool: LIST_DATASETS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        output: result.output,
      });
    } else {
      await addToolOutput({
        state: "output-error",
        tool: LIST_DATASETS_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: result.error,
      });
    }
  },
});
