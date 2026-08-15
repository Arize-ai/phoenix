import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import { SET_VARIABLE_VALUES_TOOL_NAME } from "./constants";
import { parseSetVariableValuesInput } from "./parsers";
import type { SetVariableValuesInput } from "./types";

export const setVariableValuesAgentTool =
  defineClientActionTool<SetVariableValuesInput>({
    name: SET_VARIABLE_VALUES_TOOL_NAME,
    parseInput: parseSetVariableValuesInput,
    invalidInputErrorText: `Invalid ${SET_VARIABLE_VALUES_TOOL_NAME} input. Expected { values: { key: string, value: string }[] }.`,
    notMountedErrorText:
      "The playground is not mounted; cannot set playground variable values.",
    defaultSuccessOutput: "Playground variable values updated.",
  });
