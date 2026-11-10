import { useOutletContext } from "react-router";

import type { projectEvaluatorDetailsLoaderQuery$data } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorDetailsLoaderQuery.graphql";

/** The evaluator the details page loaded, once it is known to be one. */
export type LoadedProjectEvaluator = Extract<
  NonNullable<projectEvaluatorDetailsLoaderQuery$data["projectEvaluator"]>,
  { __typename: "ProjectEvaluator" }
>;

/**
 * What the details page's tab routes, and the drawers and slideovers nested
 * under them, read from it through the outlet.
 */
export type ProjectEvaluatorDetailsOutletContext = {
  projectEvaluator: LoadedProjectEvaluator;
  /**
   * One closed time range shared by the overview strip and the metrics tab;
   * independently frozen ranges would close a live range at different
   * instants and turn identical chart queries into cache misses on tab
   * switches.
   */
  timeRange: TimeRange;
  /** Called when a brush selection on a panel narrows the range. */
  onTimeRangeSelected: (timeRange: TimeRange) => void;
};

/**
 * The details page's outlet context. `useOutletContext` takes the caller's
 * word for the type, so the one place that names it is here, beside the type
 * the page provides. A tab route passes it on to the routes nested under it.
 */
export function useProjectEvaluatorDetailsOutletContext() {
  return useOutletContext<ProjectEvaluatorDetailsOutletContext>();
}
