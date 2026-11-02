import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";

export const PLAYGROUND_PANEL_LAYOUT_ID = "playground-panels-v2";

/**
 * The ids of the panels the playground mounts, top to bottom. The mounted set
 * varies with the input; keying the saved layout by these ids keeps each
 * set's layout separate so switching doesn't clobber the other's.
 */
export function getPlaygroundPanelIds({
  isDatasetMode,
  templateFormat,
}: {
  isDatasetMode: boolean;
  templateFormat: TemplateFormat;
}): string[] {
  if (isDatasetMode) {
    return ["prompts", "io"];
  }
  return templateFormat !== TemplateFormats.NONE
    ? ["prompts", "input", "output"]
    : ["prompts", "output"];
}
