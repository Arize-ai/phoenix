import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import { SET_PLAYGROUND_REPETITIONS_TOOL_NAME } from "./constants";
import { parseSetPlaygroundRepetitionsInput } from "./parsers";
import type { SetPlaygroundRepetitionsInput } from "./types";

export const setPlaygroundRepetitionsAgentTool =
  defineClientActionTool<SetPlaygroundRepetitionsInput>({
    name: SET_PLAYGROUND_REPETITIONS_TOOL_NAME,
    parseInput: parseSetPlaygroundRepetitionsInput,
    invalidInputErrorText: `Invalid ${SET_PLAYGROUND_REPETITIONS_TOOL_NAME} input. Expected { repetitions: number } where repetitions is an integer between 1 and 30.`,
    notMountedErrorText:
      "The playground is not mounted; cannot set playground repetitions.",
    defaultSuccessOutput: "Playground repetitions updated.",
  });
