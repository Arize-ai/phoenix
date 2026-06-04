import { selectActiveContexts } from "@phoenix/agent/context/selectors";
import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";

import { GET_ROUTE_INFO_TOOL_NAME } from "./constants";
import { getRouteInfo } from "./getRouteInfo";
import { parseGetRouteInfoInput } from "./parsers";
import type { GetRouteInfoInput } from "./types";

/**
 * Standalone executor: resolves route / navigation info from the route catalog
 * using the session's active contexts and returns it directly. It delegates to
 * no page action, so it is built with the lower-level `defineTool`.
 */
export const getRouteInfoAgentTool = defineTool<GetRouteInfoInput>({
  name: GET_ROUTE_INFO_TOOL_NAME,
  parseInput: parseGetRouteInfoInput,
  invalidInputErrorText: `Invalid ${GET_ROUTE_INFO_TOOL_NAME} input. Expected { query?: string, path?: string, limit?: number }.`,
  execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
    const result = await getRouteInfo({
      input,
      contexts: selectActiveContexts(agentStore.getState()),
    });
    await addToolOutput({
      state: "output-available",
      tool: GET_ROUTE_INFO_TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      output: JSON.stringify(result, null, 2),
    });
  },
});
