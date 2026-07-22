import type { Completion } from "@codemirror/autocomplete";

import { createLoadedCompletionSection } from "./DSLFilterConditionField";

/**
 * Expands names of annotation-like objects (annotations, evaluations) into
 * completions for their filterable members — `.label`, `.score`, and
 * `.explanation` — grouped under `sectionName` below the built-in
 * Suggestions and Fields groups. Intended for `loadCompletions` results so
 * the typeahead can suggest values that actually exist in the user's data.
 */
export function createAnnotationMemberCompletions({
  accessor,
  noun,
  sectionName,
  names,
}: {
  /** DSL accessor for the collection, e.g. "annotations" or "evals" */
  accessor: string;
  /** Human-readable noun for the info text, e.g. "annotation" */
  noun: string;
  /** Typeahead group header for these completions */
  sectionName: string;
  /** Names that exist in the user's data */
  names: readonly string[];
}): Completion[] {
  const section = createLoadedCompletionSection(sectionName);
  return names.flatMap((name) => [
    {
      label: `${accessor}['${name}'].label`,
      type: "variable",
      info: `The label of the '${name}' ${noun}`,
      section,
    },
    {
      label: `${accessor}['${name}'].score`,
      type: "variable",
      info: `The score of the '${name}' ${noun}`,
      section,
    },
    {
      label: `${accessor}['${name}'].explanation`,
      type: "variable",
      info: `The explanation of the '${name}' ${noun}`,
      section,
    },
  ]);
}
