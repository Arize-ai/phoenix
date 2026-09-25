import { useMemo } from "react";
import { useLocation, useResolvedPath } from "react-router";

import {
  PROJECT_EVALUATOR_COMPARE_PARAM,
  PROJECT_EVALUATOR_COMPARE_SELECTION_PARAM,
  PROJECT_EVALUATOR_GALLERY_CATEGORY_PARAM,
} from "@phoenix/constants/searchParams";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import type { EvaluatorCategory } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorTemplatesQuery.graphql";
import { withSearchParams } from "@phoenix/utils/urlUtils";

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
  newLlmFromTemplate: (templateName: string) => string;
  copyLlm: (evaluatorId: string) => string;
  copyCode: (evaluatorId: string) => string;
  attachCode: (evaluatorId: string) => string;
};

/** Drops the search params that belong to a sub-view a destination leaves. */
const withoutCompareParams = (search: string) =>
  withSearchParams(search, (searchParams) => {
    searchParams.delete(PROJECT_EVALUATOR_COMPARE_PARAM);
    searchParams.delete(PROJECT_EVALUATOR_COMPARE_SELECTION_PARAM);
  });

/**
 * The evaluator destinations for the project currently in the URL.
 *
 * The gallery and the edit flow are nested routes rather than component state,
 * so each can be linked, restored on reload, and closed with the browser's
 * back button. Evaluator ids are Relay global ids, which are base64 and may
 * carry characters that are not path safe, so they are encoded into a single
 * segment.
 */
export function useProjectEvaluatorPaths() {
  const { rootPath } = useProjectRootPath();
  // Overlays are sub-views of the list, not new destinations, so moving
  // between them carries the list's URL state -- above all a custom time
  // range, which would otherwise be dropped on the way in and again on the
  // way out. Params scoped to a sub-view (the compare selection, the gallery
  // category) are dropped so they do not follow the user out of it.
  const { search } = useLocation();
  return useMemo(() => {
    const list = projectEvaluatorsPath(rootPath);
    const gallery = `${list}/gallery`;
    const listSearch = withSearchParams(
      withoutCompareParams(search),
      (searchParams) => {
        searchParams.delete(PROJECT_EVALUATOR_GALLERY_CATEGORY_PARAM);
      }
    );
    return {
      list: `${list}${listSearch}`,
      compare: ({ a, b }: { a: string; b: string }) =>
        `${list}/compare${withSearchParams(listSearch, (searchParams) => {
          searchParams.append(PROJECT_EVALUATOR_COMPARE_PARAM, a);
          searchParams.append(PROJECT_EVALUATOR_COMPARE_PARAM, b);
        })}`,
      /** The gallery modal over the list, optionally opened on a category. */
      gallery: (category?: EvaluatorCategory) =>
        `${gallery}${withSearchParams(listSearch, (searchParams) => {
          if (category) {
            searchParams.set(
              PROJECT_EVALUATOR_GALLERY_CATEGORY_PARAM,
              category
            );
          }
        })}`,
      details: (projectEvaluatorId: string) =>
        `${list}/${encodeURIComponent(projectEvaluatorId)}${listSearch}`,
      edit: (projectEvaluatorId: string) =>
        `${list}/${encodeURIComponent(projectEvaluatorId)}/edit${listSearch}`,
    };
  }, [rootPath, search]);
}

/**
 * The evaluator creation slideover paths, anchored at the calling component's
 * route. The creation routes nest under both the evaluator list and the
 * gallery modal, so a menu rendered by the list opens a slideover over the
 * list and one rendered by the gallery opens it over the gallery -- and each
 * dismisses back to where it was opened from -- without the caller having to
 * know which parent it is in. A slideover keeps its parent's search, gallery
 * category included, so a reload restores the parent underneath it.
 */
export function useProjectEvaluatorCreationPaths(): ProjectEvaluatorCreationPaths {
  const { pathname: parentPath } = useResolvedPath(".");
  const { search } = useLocation();
  return useMemo(() => {
    const parentSearch = withoutCompareParams(search);
    const creation = (path: string) =>
      `${parentPath}/new/${path}${parentSearch}`;
    return {
      newLlm: creation("llm"),
      newCode: creation("code"),
      newLlmFromTemplate: (templateName: string) =>
        creation(`template/${encodeURIComponent(templateName)}`),
      copyLlm: (evaluatorId: string) =>
        creation(`copy-llm/${encodeURIComponent(evaluatorId)}`),
      copyCode: (evaluatorId: string) =>
        creation(`copy-code/${encodeURIComponent(evaluatorId)}`),
      attachCode: (evaluatorId: string) =>
        creation(`attach/${encodeURIComponent(evaluatorId)}`),
    };
  }, [parentPath, search]);
}
