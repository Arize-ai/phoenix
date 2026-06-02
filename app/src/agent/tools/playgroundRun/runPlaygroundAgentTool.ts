import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import { RUN_PLAYGROUND_TOOL_NAME } from "./constants";
import { parseRunPlaygroundInput } from "./parsers";
import type { RunPlaygroundInput } from "./types";

export const runPlaygroundAgentTool =
  defineClientActionTool<RunPlaygroundInput>({
    name: RUN_PLAYGROUND_TOOL_NAME,
    parseInput: parseRunPlaygroundInput,
    invalidInputErrorText: `Invalid ${RUN_PLAYGROUND_TOOL_NAME} input. Expected {}.`,
    notMountedErrorText:
      "The playground is not mounted; cannot run the playground.",
    defaultSuccessOutput: "Playground run started.",
  });
