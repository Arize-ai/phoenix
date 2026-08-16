import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import { SET_APPENDED_MESSAGES_PATH_TOOL_NAME } from "./constants";
import { parseSetAppendedMessagesPathInput } from "./parsers";
import type { SetAppendedMessagesPathInput } from "./types";

export const setAppendedMessagesPathAgentTool =
  defineClientActionTool<SetAppendedMessagesPathInput>({
    name: SET_APPENDED_MESSAGES_PATH_TOOL_NAME,
    parseInput: parseSetAppendedMessagesPathInput,
    invalidInputErrorText: `Invalid ${SET_APPENDED_MESSAGES_PATH_TOOL_NAME} input. Expected { path: string | null }.`,
    notMountedErrorText:
      "The playground is not mounted; cannot set the appended messages path.",
    defaultSuccessOutput: "Appended messages path updated.",
  });
