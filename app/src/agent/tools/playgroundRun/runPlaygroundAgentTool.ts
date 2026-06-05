import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import {
  CANCEL_PLAYGROUND_RUN_TOOL_NAME,
  RUN_PLAYGROUND_TOOL_NAME,
} from "./constants";
import {
  parseCancelPlaygroundRunInput,
  parseRunPlaygroundInput,
} from "./parsers";
import type { CancelPlaygroundRunInput, RunPlaygroundInput } from "./types";

export const runPlaygroundAgentTool =
  defineClientActionTool<RunPlaygroundInput>({
    name: RUN_PLAYGROUND_TOOL_NAME,
    parseInput: parseRunPlaygroundInput,
    invalidInputErrorText: `Invalid ${RUN_PLAYGROUND_TOOL_NAME} input. Expected {}.`,
    notMountedErrorText:
      "The playground is not mounted; cannot run the playground.",
    defaultSuccessOutput: "Playground run started.",
  });

export const cancelPlaygroundRunAgentTool =
  defineClientActionTool<CancelPlaygroundRunInput>({
    name: CANCEL_PLAYGROUND_RUN_TOOL_NAME,
    parseInput: parseCancelPlaygroundRunInput,
    invalidInputErrorText: `Invalid ${CANCEL_PLAYGROUND_RUN_TOOL_NAME} input. Expected {}.`,
    notMountedErrorText:
      "The playground is not mounted; cannot cancel a playground run.",
    defaultSuccessOutput: "Playground run cancelled.",
  });
