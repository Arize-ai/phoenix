import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import type { PlaygroundMode } from "@phoenix/store/playground/types";

export const PLAYGROUND_PANEL_LAYOUT_ID = "playground-panels-v2";

/**
 * The ids of the panels the playground mounts, top to bottom. The mounted set
 * varies with the input; keying the saved layout by these ids keeps each
 * set's layout separate so switching doesn't clobber the other's.
 */
export function getPlaygroundPanelIds({
  isDatasetMode,
  templateFormat,
  mode = "task",
  hasDecisionInputState = false,
}: {
  isDatasetMode: boolean;
  templateFormat: TemplateFormat;
  mode?: PlaygroundMode;
  hasDecisionInputState?: boolean;
}): string[] {
  // Evaluator tasks have no manual input, so without a dataset they show the
  // same two panels as a dataset does.
  if (isDatasetMode || mode === "evaluator") {
    return ["prompts", "io"];
  }
  return templateFormat !== TemplateFormats.NONE || hasDecisionInputState
    ? ["prompts", "input", "output"]
    : ["prompts", "output"];
}
