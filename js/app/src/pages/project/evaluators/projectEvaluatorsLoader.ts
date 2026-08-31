import { graphql, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import { replace } from "react-router";
import invariant from "tiny-invariant";

import type { TimeRangeISOStrings } from "@phoenix/components/datetime";
import type { LastNTimeRangeKey } from "@phoenix/components/datetime/types";
import {
  getTimeRangeFromLastNTimeRangeKey,
  getTimeRangeFromSearchParams,
  isLastNTimeRangeKey,
} from "@phoenix/components/datetime/utils";
import {
  CREATE_CODE_EVALUATOR_PARAM,
  CREATE_LLM_EVALUATOR_PARAM,
} from "@phoenix/constants/searchParams";
import type { projectEvaluatorsLoaderQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorsLoaderQuery.graphql";
import {
  newCodeProjectEvaluatorPath,
  newLlmProjectEvaluatorPath,
} from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import RelayEnvironment from "@phoenix/RelayEnvironment";
import { PREFERENCES_STORAGE_KEY } from "@phoenix/store/preferencesStore";
import { withSearchParams } from "@phoenix/utils/urlUtils";

export const projectEvaluatorsLoaderGQL = graphql`
  query projectEvaluatorsLoaderQuery(
    $projectId: ID!
    $filter: ProjectEvaluatorFilter
    $timeRange: TimeRange!
  ) {
    project: node(id: $projectId) {
      ... on Project {
        evaluatorCount
        ...ProjectEvaluatorsTable_project
          @arguments(filter: $filter, timeRange: $timeRange)
      }
    }
  }
`;

/**
 * The stored last-N preference the time range provider falls back to when the
 * URL carries no range. Loaders run before React mounts, so this reads the
 * persisted store directly; {@link PREFERENCES_STORAGE_KEY} keeps the two in
 * sync. A missing or malformed value falls back to the provider's own default.
 */
function getStoredLastNTimeRangeKey(): LastNTimeRangeKey {
  try {
    const persisted = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    const key = persisted
      ? JSON.parse(persisted)?.state?.lastNTimeRangeKey
      : null;
    if (isLastNTimeRangeKey(key)) {
      return key;
    }
  } catch {
    // Unreadable storage or malformed JSON: fall through to the default.
  }
  return "7d";
}

/**
 * Resolves the same time range TimeRangeProvider will resolve on mount: the
 * URL search params when they carry a usable range, the stored last-N
 * preference otherwise. Last-N windows snap (to the minute, or the hour for
 * windows over an hour), so the loader and the provider agree on the exact
 * variables and the table's mount guard skips the duplicate refetch.
 */
function getPageTimeRange(searchParams: URLSearchParams): TimeRangeISOStrings {
  const timeRange =
    getTimeRangeFromSearchParams(searchParams) ??
    getTimeRangeFromLastNTimeRangeKey(getStoredLastNTimeRangeKey());
  return {
    start: timeRange.start?.toISOString(),
    end: timeRange.end?.toISOString(),
  };
}

export type ProjectEvaluatorsLoaderData = {
  queryRef: ReturnType<typeof loadQuery<projectEvaluatorsLoaderQuery>>;
  /** The exact time range the query was loaded with. */
  timeRange: TimeRangeISOStrings;
};

/**
 * Preloads the evaluators list for the project and forwards links that open a
 * creation form with `?createLlmEvaluator=true` or `?createCodeEvaluator=true`
 * to the routes that replaced them, so links minted before the slideovers
 * became route-driven still open the right form. Both params remain the live
 * mechanism on the dataset evaluators page.
 */
export function projectEvaluatorsLoader(
  args: LoaderFunctionArgs
): Response | ProjectEvaluatorsLoaderData {
  const url = new URL(args.request.url);
  // This loader also runs for the nested creation routes, which have already
  // matched; only the list path itself needs forwarding.
  const projectRootPath = url.pathname.match(/^(.*)\/evaluators\/?$/)?.[1];
  if (projectRootPath != null) {
    const opensLlmForm =
      url.searchParams.get(CREATE_LLM_EVALUATOR_PARAM) === "true";
    const opensCodeForm =
      url.searchParams.get(CREATE_CODE_EVALUATOR_PARAM) === "true";
    if (opensLlmForm || opensCodeForm) {
      const creationPath = opensLlmForm
        ? newLlmProjectEvaluatorPath(projectRootPath)
        : newCodeProjectEvaluatorPath(projectRootPath);
      const search = withSearchParams(url.search, (params) => {
        params.delete(CREATE_LLM_EVALUATOR_PARAM);
        params.delete(CREATE_CODE_EVALUATOR_PARAM);
      });
      // `replace`, not `redirect`: a pushed entry would leave the legacy URL
      // one step back, so the back button would land on it and be forwarded
      // here again.
      return replace(`${creationPath}${search}`);
    }
  }
  const { projectId } = args.params;
  invariant(projectId, "projectId is required");
  const timeRange = getPageTimeRange(url.searchParams);
  return {
    queryRef: loadQuery<projectEvaluatorsLoaderQuery>(
      RelayEnvironment,
      projectEvaluatorsLoaderGQL,
      // The toolbar search always starts empty on a fresh mount, so the
      // loader fetches unfiltered; the table refetches when the user types.
      { projectId, filter: null, timeRange },
      { fetchPolicy: "store-and-network" }
    ),
    timeRange,
  };
}
