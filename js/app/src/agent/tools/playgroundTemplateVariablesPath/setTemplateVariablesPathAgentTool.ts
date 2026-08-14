import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import { SET_TEMPLATE_VARIABLES_PATH_TOOL_NAME } from "./constants";
import { parseSetTemplateVariablesPathInput } from "./parsers";
import type { SetTemplateVariablesPathInput } from "./types";

export const setTemplateVariablesPathAgentTool =
  defineClientActionTool<SetTemplateVariablesPathInput>({
    name: SET_TEMPLATE_VARIABLES_PATH_TOOL_NAME,
    parseInput: parseSetTemplateVariablesPathInput,
    invalidInputErrorText: `Invalid ${SET_TEMPLATE_VARIABLES_PATH_TOOL_NAME} input. Expected { path: string | null }.`,
    notMountedErrorText:
      "The playground is not mounted; cannot set the template variables path.",
    defaultSuccessOutput: "Template variables path updated.",
  });
