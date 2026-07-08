import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import { SET_SESSIONS_FILTER_TOOL_NAME } from "./constants";
import { parseSetSessionsFilterInput } from "./parsers";
import type { SetSessionsFilterInput } from "./types";

export const setSessionsFilterAgentTool =
  defineClientActionTool<SetSessionsFilterInput>({
    name: SET_SESSIONS_FILTER_TOOL_NAME,
    parseInput: parseSetSessionsFilterInput,
    invalidInputErrorText: `Invalid ${SET_SESSIONS_FILTER_TOOL_NAME} input. Expected { condition: string }.`,
    notMountedErrorText:
      "The session filter field is not mounted on this page; cannot update the sessions filter.",
    defaultSuccessOutput: "Sessions filter updated.",
  });
