import { isStringKeyedObject } from "@phoenix/typeUtils";

import type { PlaygroundStateByDatasetId, PlaygroundTaskKind } from "./types";

/**
 * Where a prompt task's template variables resolve from until someone
 * changes it: `{{query}}` is `input.query` of the dataset example.
 */
export const DEFAULT_TEMPLATE_VARIABLES_PATH = "input";

/**
 * A template variables path for each kind of task: a dot-notation prefix
 * into the example context `{input, reference, metadata}`, or null for the
 * example root.
 */
export type TemplateVariablesPathByTaskKind = Record<
  PlaygroundTaskKind,
  string | null
>;

/**
 * Each kind's path until someone changes it. Prompt tasks read variables
 * from `input`; an evaluator's input mapping addresses `input`, `output` and
 * `metadata` from the example root, so evaluator tasks start there.
 */
export const DEFAULT_TEMPLATE_VARIABLES_PATH_BY_TASK_KIND: TemplateVariablesPathByTaskKind =
  {
    prompt: DEFAULT_TEMPLATE_VARIABLES_PATH,
    evaluator: null,
  };

/**
 * The template variables path of one kind of task over one dataset. Before
 * the dataset has any state, the kind's default.
 */
export function getTemplateVariablesPath({
  stateByDatasetId,
  datasetId,
  taskKind,
}: {
  stateByDatasetId: PlaygroundStateByDatasetId;
  datasetId: string;
  taskKind: PlaygroundTaskKind;
}): string | null {
  const datasetState = stateByDatasetId[datasetId];

  return datasetState
    ? datasetState.templateVariablesPathByTaskKind[taskKind]
    : DEFAULT_TEMPLATE_VARIABLES_PATH_BY_TASK_KIND[taskKind];
}

/**
 * Persisted dataset state from before paths were kept per kind of task holds
 * one `templateVariablesPath`, which was the prompt tasks'. Carry it over and
 * start the evaluator kind at its default, so a stored choice survives the
 * upgrade.
 */
export function migrateTemplateVariablesPath(datasetState: unknown): unknown {
  if (
    !isStringKeyedObject(datasetState) ||
    "templateVariablesPathByTaskKind" in datasetState
  ) {
    return datasetState;
  }

  const { templateVariablesPath, ...rest } = datasetState;

  return {
    ...rest,
    templateVariablesPathByTaskKind: {
      ...DEFAULT_TEMPLATE_VARIABLES_PATH_BY_TASK_KIND,
      prompt:
        typeof templateVariablesPath === "string" ||
        templateVariablesPath === null
          ? templateVariablesPath
          : DEFAULT_TEMPLATE_VARIABLES_PATH,
    },
  };
}
