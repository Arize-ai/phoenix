import { isStringKeyedObject } from "@phoenix/typeUtils";

import type { PlaygroundStateByDatasetId, PlaygroundTaskRole } from "./types";

/**
 * Where a tested task's template variables resolve from until someone
 * changes it: `{{query}}` is `input.query` of the dataset example.
 */
export const DEFAULT_TEMPLATE_VARIABLES_PATH = "input";

/**
 * A template variables path for each role: a dot-notation prefix into the
 * example context `{input, reference, metadata}`, or null for the example
 * root. The path belongs to the role, not the member: a decision reads its
 * inputs from where prompts read their template variables.
 */
export type TemplateVariablesPathByRole = Record<
  PlaygroundTaskRole,
  string | null
>;

/**
 * Each role's path until someone changes it. Tested tasks read variables
 * from `input`; an evaluator's input mapping addresses `input`, `output` and
 * `metadata` from the example root, so judging tasks start there.
 */
export const DEFAULT_TEMPLATE_VARIABLES_PATH_BY_ROLE: TemplateVariablesPathByRole =
  {
    tested: DEFAULT_TEMPLATE_VARIABLES_PATH,
    judging: null,
  };

/**
 * The template variables path of one role over one dataset. Before the
 * dataset has any state, the role's default.
 */
export function getTemplateVariablesPath({
  stateByDatasetId,
  datasetId,
  taskRole,
}: {
  stateByDatasetId: PlaygroundStateByDatasetId;
  datasetId: string;
  taskRole: PlaygroundTaskRole;
}): string | null {
  const datasetState = stateByDatasetId[datasetId];

  return datasetState
    ? datasetState.templateVariablesPathByRole[taskRole]
    : DEFAULT_TEMPLATE_VARIABLES_PATH_BY_ROLE[taskRole];
}

/**
 * Persisted dataset state from before paths were kept per role holds either
 * one `templateVariablesPath`, which was the prompt tasks', or paths keyed by
 * the old kinds, `prompt` and `evaluator`. Carry the tested path over and
 * start the judging role at its default or its stored value, so a stored
 * choice survives the upgrade.
 */
export function migrateTemplateVariablesPath(datasetState: unknown): unknown {
  if (
    !isStringKeyedObject(datasetState) ||
    "templateVariablesPathByRole" in datasetState
  ) {
    return datasetState;
  }

  const { templateVariablesPath, templateVariablesPathByTaskKind, ...rest } =
    datasetState;

  const isPath = (value: unknown): value is string | null =>
    typeof value === "string" || value === null;

  if (isStringKeyedObject(templateVariablesPathByTaskKind)) {
    const { prompt, evaluator } = templateVariablesPathByTaskKind;

    return {
      ...rest,
      templateVariablesPathByRole: {
        tested: isPath(prompt) ? prompt : DEFAULT_TEMPLATE_VARIABLES_PATH,
        judging: isPath(evaluator)
          ? evaluator
          : DEFAULT_TEMPLATE_VARIABLES_PATH_BY_ROLE.judging,
      },
    };
  }

  return {
    ...rest,
    templateVariablesPathByRole: {
      ...DEFAULT_TEMPLATE_VARIABLES_PATH_BY_ROLE,
      tested: isPath(templateVariablesPath)
        ? templateVariablesPath
        : DEFAULT_TEMPLATE_VARIABLES_PATH,
    },
  };
}
