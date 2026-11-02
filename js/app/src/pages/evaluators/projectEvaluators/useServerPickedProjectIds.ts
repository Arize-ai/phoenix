import { useSearchParams } from "react-router";

import { normalizePickedProjectIds } from "@phoenix/pages/evaluators/projectEvaluators/serverProjectSeries";

/** The projects picked to show, repeated once per project. */
const PROJECT_PARAM = "project";

/**
 * The projects picked on the server-wide evaluator pages, kept in the URL so
 * the picks survive a reload and carry between the list and its health page.
 */
export function useServerPickedProjectIds() {
  const [searchParams, setSearchParams] = useSearchParams();
  const pickedProjectIds = normalizePickedProjectIds(
    searchParams.getAll(PROJECT_PARAM)
  );
  const setPickedProjectIds = (projectIds: string[]) =>
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        next.delete(PROJECT_PARAM);
        for (const projectId of normalizePickedProjectIds(projectIds)) {
          next.append(PROJECT_PARAM, projectId);
        }
        return next;
      },
      { replace: true }
    );
  return { pickedProjectIds, setPickedProjectIds };
}
