import { useMemo } from "react";

import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";

/**
 * Paths for the project evaluator slideovers.
 *
 * Every creation flow and the edit flow is a nested route under the evaluators
 * tab rather than component state, so each one can be linked, restored on
 * reload, and closed with the browser's back button.
 *
 * Evaluator ids are Relay global ids, which are base64 and may carry characters
 * that are not path safe, so they are encoded into a single segment.
 */

export const projectEvaluatorsPath = (projectRootPath: string) =>
  `${projectRootPath}/evaluators`;

export const newLlmProjectEvaluatorPath = (projectRootPath: string) =>
  `${projectEvaluatorsPath(projectRootPath)}/new/llm`;

export const newCodeProjectEvaluatorPath = (projectRootPath: string) =>
  `${projectEvaluatorsPath(projectRootPath)}/new/code`;

export const copyLlmProjectEvaluatorPath = (
  projectRootPath: string,
  evaluatorId: string
) =>
  `${projectEvaluatorsPath(projectRootPath)}/new/copy/${encodeURIComponent(evaluatorId)}`;

export const attachCodeProjectEvaluatorPath = (
  projectRootPath: string,
  evaluatorId: string
) =>
  `${projectEvaluatorsPath(projectRootPath)}/new/attach/${encodeURIComponent(evaluatorId)}`;

export const editProjectEvaluatorPath = (
  projectRootPath: string,
  projectEvaluatorId: string
) =>
  `${projectEvaluatorsPath(projectRootPath)}/${encodeURIComponent(projectEvaluatorId)}/edit`;

/**
 * The evaluator slideover paths for the project currently in the URL.
 */
export function useProjectEvaluatorPaths() {
  const { rootPath } = useProjectRootPath();
  return useMemo(
    () => ({
      list: projectEvaluatorsPath(rootPath),
      newLlm: newLlmProjectEvaluatorPath(rootPath),
      newCode: newCodeProjectEvaluatorPath(rootPath),
      copyLlm: (evaluatorId: string) =>
        copyLlmProjectEvaluatorPath(rootPath, evaluatorId),
      attachCode: (evaluatorId: string) =>
        attachCodeProjectEvaluatorPath(rootPath, evaluatorId),
      edit: (projectEvaluatorId: string) =>
        editProjectEvaluatorPath(rootPath, projectEvaluatorId),
    }),
    [rootPath]
  );
}
