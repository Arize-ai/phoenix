import { useMemo } from "react";
import { useLocation } from "react-router";

import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";

const projectEvaluatorsPath = (projectRootPath: string) =>
  `${projectRootPath}/evaluators`;

/**
 * Exported for the loader that forwards the legacy `?createLlmEvaluator` and
 * `?createCodeEvaluator` links, which has a path rather than a project root.
 */
export const newLlmProjectEvaluatorPath = (projectRootPath: string) =>
  `${projectEvaluatorsPath(projectRootPath)}/new/llm`;

export const newCodeProjectEvaluatorPath = (projectRootPath: string) =>
  `${projectEvaluatorsPath(projectRootPath)}/new/code`;

export type ProjectEvaluatorCreationPaths = {
  newLlm: string;
  newCode: string;
  copyLlm: (evaluatorId: string) => string;
  copyCode: (evaluatorId: string) => string;
  attachCode: (evaluatorId: string) => string;
};

/**
 * The evaluator slideover paths for the project currently in the URL.
 *
 * Every creation flow and the edit flow is a nested route rather than component
 * state, so each can be linked, restored on reload, and closed with the
 * browser's back button. Evaluator ids are Relay global ids, which are base64
 * and may carry characters that are not path safe, so they are encoded into a
 * single segment.
 */
export function useProjectEvaluatorPaths() {
  const { rootPath } = useProjectRootPath();
  // A slideover is a sub-view of its parent page, not a new destination, so
  // opening and closing one carries the page's URL state -- above all a custom
  // time range, which would otherwise be dropped on the way in and again on
  // the way out.
  const { search } = useLocation();
  return useMemo(() => {
    const list = projectEvaluatorsPath(rootPath);
    const withCurrentSearch = (path: string) => `${path}${search}`;
    const buildCreationPaths = (
      parentPath: string
    ): ProjectEvaluatorCreationPaths => ({
      newLlm: withCurrentSearch(`${parentPath}/new/llm`),
      newCode: withCurrentSearch(`${parentPath}/new/code`),
      copyLlm: (evaluatorId: string) =>
        withCurrentSearch(
          `${parentPath}/new/copy-llm/${encodeURIComponent(evaluatorId)}`
        ),
      copyCode: (evaluatorId: string) =>
        withCurrentSearch(
          `${parentPath}/new/copy-code/${encodeURIComponent(evaluatorId)}`
        ),
      attachCode: (evaluatorId: string) =>
        withCurrentSearch(
          `${parentPath}/new/attach/${encodeURIComponent(evaluatorId)}`
        ),
    });
    return {
      list: withCurrentSearch(list),
      creation: buildCreationPaths(list),
      newLlmFromTemplate: (templateName: string) =>
        withCurrentSearch(
          `${list}/new/template/${encodeURIComponent(templateName)}`
        ),
      details: (projectEvaluatorId: string) =>
        withCurrentSearch(`${list}/${encodeURIComponent(projectEvaluatorId)}`),
      edit: (projectEvaluatorId: string) =>
        withCurrentSearch(
          `${list}/${encodeURIComponent(projectEvaluatorId)}/edit`
        ),
    };
  }, [rootPath, search]);
}
