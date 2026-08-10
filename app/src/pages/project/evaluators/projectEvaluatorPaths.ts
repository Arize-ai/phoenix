import { useMemo } from "react";

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
  return useMemo(() => {
    const list = projectEvaluatorsPath(rootPath);
    return {
      list,
      newLlm: newLlmProjectEvaluatorPath(rootPath),
      newCode: newCodeProjectEvaluatorPath(rootPath),
      copyLlm: (evaluatorId: string) =>
        `${list}/new/copy/${encodeURIComponent(evaluatorId)}`,
      attachCode: (evaluatorId: string) =>
        `${list}/new/attach/${encodeURIComponent(evaluatorId)}`,
      edit: (projectEvaluatorId: string) =>
        `${list}/${encodeURIComponent(projectEvaluatorId)}/edit`,
    };
  }, [rootPath]);
}
