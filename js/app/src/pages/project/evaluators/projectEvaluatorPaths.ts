import { useMemo } from "react";
import { useLocation } from "react-router";

import {
  PROJECT_EVALUATOR_CATEGORY_PARAM,
  PROJECT_EVALUATOR_TEMPLATE_PARAM,
} from "@phoenix/constants/searchParams";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import type { EvaluatorCategory } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorTemplatesQuery.graphql";
import { withSearchParams } from "@phoenix/utils/urlUtils";

const projectEvaluatorsPath = (projectRootPath: string) =>
  `${projectRootPath}/evaluators`;

const projectEvaluatorGalleryPath = (projectRootPath: string) =>
  `${projectRootPath}/evaluator-gallery`;

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
  // A slideover is a sub-view of its parent page, not a new destination, so
  // opening and closing one carries the page's URL state -- above all a custom
  // time range, which would otherwise be dropped on the way in and again on
  // the way out.
  const { search } = useLocation();
  return useMemo(() => {
    const list = projectEvaluatorsPath(rootPath);
    const gallery = projectEvaluatorGalleryPath(rootPath);
    const withCurrentSearch = (path: string) => `${path}${search}`;
    // A fresh gallery entry clears stale selection while preserving unrelated
    // project-page state in the query string.
    const defaultGallerySearch = withSearchParams(search, (searchParams) => {
      searchParams.delete(PROJECT_EVALUATOR_CATEGORY_PARAM);
      searchParams.delete(PROJECT_EVALUATOR_TEMPLATE_PARAM);
    });
    return {
      list: withCurrentSearch(list),
      gallery: `${gallery}${defaultGallerySearch}`,
      // Nested gallery routes use this exact return URL when they close.
      galleryReturn: withCurrentSearch(gallery),
      galleryCategory: (category: EvaluatorCategory) =>
        `${gallery}${withSearchParams(search, (searchParams) => {
          searchParams.set(PROJECT_EVALUATOR_CATEGORY_PARAM, category);
          searchParams.delete(PROJECT_EVALUATOR_TEMPLATE_PARAM);
        })}`,
      galleryTemplate: ({
        category,
        templateName,
      }: {
        category: EvaluatorCategory;
        templateName: string;
      }) =>
        `${gallery}${withSearchParams(search, (searchParams) => {
          searchParams.set(PROJECT_EVALUATOR_CATEGORY_PARAM, category);
          searchParams.set(PROJECT_EVALUATOR_TEMPLATE_PARAM, templateName);
        })}`,
      newLlm: withCurrentSearch(newLlmProjectEvaluatorPath(rootPath)),
      newCode: withCurrentSearch(newCodeProjectEvaluatorPath(rootPath)),
      galleryNewLlmFromTemplate: (templateName: string) =>
        withCurrentSearch(
          `${gallery}/new/template/${encodeURIComponent(templateName)}`
        ),
      copyLlm: (evaluatorId: string) =>
        withCurrentSearch(
          `${list}/new/copy/${encodeURIComponent(evaluatorId)}`
        ),
      attachCode: (evaluatorId: string) =>
        withCurrentSearch(
          `${list}/new/attach/${encodeURIComponent(evaluatorId)}`
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
