import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import { READ_PLAYGROUND_OUTPUT_TOOL_NAME } from "./constants";
import { parseReadPlaygroundOutputInput } from "./parsers";
import type { ReadPlaygroundOutputInput } from "./types";

export const readPlaygroundOutputAgentTool =
  defineClientActionTool<ReadPlaygroundOutputInput>({
    name: READ_PLAYGROUND_OUTPUT_TOOL_NAME,
    parseInput: parseReadPlaygroundOutputInput,
    invalidInputErrorText: `Invalid ${READ_PLAYGROUND_OUTPUT_TOOL_NAME} input. Expected { instanceId?: number, repetitionNumber?: number }.`,
    notMountedErrorText:
      "The playground is not mounted; cannot read playground output.",
    defaultSuccessOutput: "Playground output read.",
  });
