import { useMemo } from "react";
import { useLocation, useParams, useResolvedPath } from "react-router";

import {
  PROJECT_EVALUATOR_COMPARE_PARAM,
  PROJECT_EVALUATOR_COMPARE_SELECTION_PARAM,
  PROJECT_EVALUATOR_GALLERY_CATEGORY_PARAM,
  SPAN_FILTER_CONDITION_PARAM,
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
  newDecision: string;
  newLlmFromTemplate: (templateName: string) => string;
  copyLlm: (evaluatorId: string) => string;
  copyCode: (evaluatorId: string) => string;
  attach: (evaluatorId: string) => string;
};

/**
 * The tabs of a project evaluator's details page, each a nested route so it
 * can be linked and restored on reload. The overview sits at the evaluator's
 * own path; the others at a segment of the same name under it.
 */
export const PROJECT_EVALUATOR_TABS = [
  "overview",
  "versions",
  "traces",
  "metrics",
] as const;

export type ProjectEvaluatorTab = (typeof PROJECT_EVALUATOR_TABS)[number];

export function isProjectEvaluatorTab(
  value: unknown
): value is ProjectEvaluatorTab {
  return PROJECT_EVALUATOR_TABS.some((tab) => tab === value);
}

/** The route id of a details tab, which the page reads to select it. */
export const projectEvaluatorTabRouteId = (tab: ProjectEvaluatorTab) =>
  `projectEvaluatorDetails.${tab}`;

const tabSegment = (tab: ProjectEvaluatorTab) =>
  tab === "overview" ? "" : `/${tab}`;

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
  // category) are dropped so they do not follow the user out of it. The span
  // filter is shared with the project's Spans tab but an evaluator's page
  // filters its own trace project, so it only carries within that page.
  const { search } = useLocation();
  const { projectEvaluatorId: currentProjectEvaluatorId } = useParams();
  return useMemo(() => {
    const list = projectEvaluatorsPath(rootPath);
    const gallery = `${list}/gallery`;
    const listSearch = withSearchParams(
      withoutCompareParams(search),
      (searchParams) => {
        searchParams.delete(PROJECT_EVALUATOR_GALLERY_CATEGORY_PARAM);
      }
    );
    const evaluatorSearch = (projectEvaluatorId: string) =>
      projectEvaluatorId === currentProjectEvaluatorId
        ? listSearch
        : withSearchParams(listSearch, (searchParams) => {
            searchParams.delete(SPAN_FILTER_CONDITION_PARAM);
          });
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
      /** The details page, on its overview unless a tab is given. */
      details: (
        projectEvaluatorId: string,
        tab: ProjectEvaluatorTab = "overview"
      ) =>
        `${list}/${encodeURIComponent(projectEvaluatorId)}${tabSegment(tab)}${evaluatorSearch(projectEvaluatorId)}`,
      /** The edit slideover, over the overview unless a tab is given. */
      edit: (
        projectEvaluatorId: string,
        tab: ProjectEvaluatorTab = "overview"
      ) =>
        `${list}/${encodeURIComponent(projectEvaluatorId)}${tabSegment(tab)}/edit${evaluatorSearch(projectEvaluatorId)}`,
    };
  }, [rootPath, search, currentProjectEvaluatorId]);
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
      newDecision: creation("decision"),
      newLlmFromTemplate: (templateName: string) =>
        creation(`template/${encodeURIComponent(templateName)}`),
      copyLlm: (evaluatorId: string) =>
        creation(`copy-llm/${encodeURIComponent(evaluatorId)}`),
      copyCode: (evaluatorId: string) =>
        creation(`copy-code/${encodeURIComponent(evaluatorId)}`),
      attach: (evaluatorId: string) =>
        creation(`attach/${encodeURIComponent(evaluatorId)}`),
    };
  }, [parentPath, search]);
}
