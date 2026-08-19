import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import { SET_SPANS_FILTER_TOOL_NAME } from "./constants";
import { parseSetSpansFilterInput } from "./parsers";
import type { SetSpansFilterInput } from "./types";

export const setSpansFilterAgentTool =
  defineClientActionTool<SetSpansFilterInput>({
    name: SET_SPANS_FILTER_TOOL_NAME,
    parseInput: parseSetSpansFilterInput,
    invalidInputErrorText: `Invalid ${SET_SPANS_FILTER_TOOL_NAME} input. Expected { condition: string }.`,
    notMountedErrorText:
      "The span filter field is not mounted on this page; cannot update the spans filter.",
    defaultSuccessOutput: "Spans filter updated.",
  });
