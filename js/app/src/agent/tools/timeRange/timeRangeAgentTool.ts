import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import { SET_TIME_RANGE_TOOL_NAME, TIME_RANGE_KEYS } from "./constants";
import { parseSetTimeRangeInput } from "./parsers";
import type { SetTimeRangeInput } from "./types";

const setTimeRangeInvalidInputErrorText = `Invalid ${SET_TIME_RANGE_TOOL_NAME} input. Expected { timeRangeKey: ${TIME_RANGE_KEYS.map(
  (key) => `"${key}"`
).join(" | ")}, startTime?: string, endTime?: string }.`;

/**
 * Server-advertised, client-executed: applies the app time range selector
 * registered by `TimeRangeContext`.
 */
export const setTimeRangeAgentTool = defineClientActionTool<SetTimeRangeInput>({
  name: SET_TIME_RANGE_TOOL_NAME,
  parseInput: parseSetTimeRangeInput,
  invalidInputErrorText: setTimeRangeInvalidInputErrorText,
  notMountedErrorText:
    "The app time range selector is not mounted on this page; cannot update the time range.",
  defaultSuccessOutput: "Time range updated.",
});
