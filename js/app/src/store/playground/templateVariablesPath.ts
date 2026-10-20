import type { PlaygroundStateByDatasetId, PlaygroundMode } from "./types";

/**
 * Where prompt and decision template variables resolve from until someone
 * changes it: `{{query}}` is `input.query` of the dataset example.
 */
export const DEFAULT_TEMPLATE_VARIABLES_PATH = "input";

/**
 * A template variables path for each mode: a dot-notation prefix into the
 * example context `{input, reference, metadata}`, or null for the example
 * root. The path belongs to the mode, not the member: a decision reads its
 * inputs from where prompts read their template variables.
 */
export type TemplateVariablesPathByMode = Record<PlaygroundMode, string | null>;

/**
 * Each mode's path until someone changes it. Prompt and decision tasks read variables
 * from `input`; an evaluator's input mapping addresses `input`, `output` and
 * `metadata` from the example root, so evaluator tasks start there.
 */
export const DEFAULT_TEMPLATE_VARIABLES_PATH_BY_MODE: TemplateVariablesPathByMode =
  {
    task: DEFAULT_TEMPLATE_VARIABLES_PATH,
    evaluator: null,
  };

/**
 * The template variables path of one mode over one dataset. Before the
 * dataset has any state, the mode's default.
 */
export function getTemplateVariablesPath({
  stateByDatasetId,
  datasetId,
  mode,
}: {
  stateByDatasetId: PlaygroundStateByDatasetId;
  datasetId: string;
  mode: PlaygroundMode;
}): string | null {
  const datasetState = stateByDatasetId[datasetId];

  return datasetState
    ? datasetState.templateVariablesPathByMode[mode]
    : DEFAULT_TEMPLATE_VARIABLES_PATH_BY_MODE[mode];
}
