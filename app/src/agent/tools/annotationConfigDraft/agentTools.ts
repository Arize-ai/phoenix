import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";
import {
  parseEmptyToolInput,
  type EmptyToolInput,
} from "@phoenix/agent/tools/emptyToolInput";

import { OPEN_ANNOTATION_CONFIG_FORM_TOOL_NAME } from "./constants";

/**
 * Opens the annotation-config form slideover mounted on the focused project
 * page. Delegates to the client action the slideover registers while open.
 */
export const openAnnotationConfigFormAgentTool =
  defineClientActionTool<EmptyToolInput>({
    name: OPEN_ANNOTATION_CONFIG_FORM_TOOL_NAME,
    parseInput: parseEmptyToolInput,
    invalidInputErrorText: `Invalid ${OPEN_ANNOTATION_CONFIG_FORM_TOOL_NAME} input. Expected {}.`,
    notMountedErrorText:
      "No project page is mounted; cannot open the annotation-config form.",
    defaultSuccessOutput: "Annotation-config form opened.",
  });
