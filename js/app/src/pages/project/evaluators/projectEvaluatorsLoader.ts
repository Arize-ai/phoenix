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
  EVALUATOR_FILTER_PARAM,
} from "@phoenix/constants/searchParams";
import { PROJECT_EVALUATORS_TABLE_STORAGE_KEY } from "@phoenix/contexts/ProjectEvaluatorsTableContext";
import { getUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import type { projectEvaluatorsLoaderQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorsLoaderQuery.graphql";
import {
  newCodeProjectEvaluatorPath,
  newLlmProjectEvaluatorPath,
} from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import type { EvaluatorScoreWindow } from "@phoenix/pages/project/evaluators/projectEvaluatorScoreWindow";
import { getEvaluatorScoreWindow } from "@phoenix/pages/project/evaluators/projectEvaluatorScoreWindow";
import RelayEnvironment from "@phoenix/RelayEnvironment";
import {
  DEFAULT_LAST_N_TIME_RANGE_KEY,
  PREFERENCES_STORAGE_KEY,
} from "@phoenix/store/preferencesStore";
import { withSearchParams } from "@phoenix/utils/urlUtils";

export const projectEvaluatorsLoaderGQL = graphql`
  query projectEvaluatorsLoaderQuery(
    $projectId: ID!
    $filter: ProjectEvaluatorFilter
    $timeRange: TimeRange!
    $scoreTimeRange: TimeRange!
    $scoreTimeBinConfig: TimeBinConfig!
    $includeMeanScore: Boolean!
  ) {
    project: node(id: $projectId) {
      ... on Project {
        evaluatorCount
        ...ProjectEvaluatorsTable_project
          @arguments(
            filter: $filter
            timeRange: $timeRange
            scoreTimeRange: $scoreTimeRange
            scoreTimeBinConfig: $scoreTimeBinConfig
            includeMeanScore: $includeMeanScore
          )
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
  return DEFAULT_LAST_N_TIME_RANGE_KEY;
}

/**
 * Resolves the same time range TimeRangeProvider will resolve on mount: the
 * URL search params when they carry a usable range, the stored last-N
 * preference otherwise. Last-N windows snap (to the minute, or the hour for
 * windows over an hour), so the loader and the provider agree on the exact
 * variables and the table's mount guard skips the duplicate refetch.
 */
function getPageTimeRange(searchParams: URLSearchParams) {
  const storedKey = getStoredLastNTimeRangeKey();
  return (
    getTimeRangeFromSearchParams(searchParams) ?? {
      timeRangeKey: storedKey,
      ...getTimeRangeFromLastNTimeRangeKey(storedKey),
    }
  );
}

/**
 * Whether the mean score column is visible in the persisted table
 * preferences, and its data should be fetched with the rows. Mirrors the
 * table's `columnVisibility["meanScore"] !== false` read; unreadable or
 * missing storage means the default (visible).
 */
function getStoredIncludeMeanScore(): boolean {
  try {
    const persisted = localStorage.getItem(
      PROJECT_EVALUATORS_TABLE_STORAGE_KEY
    );
    const visibility = persisted
      ? JSON.parse(persisted)?.state?.columnVisibility
      : null;
    return visibility?.meanScore !== false;
  } catch {
    return true;
  }
}

export type ProjectEvaluatorsLoaderData = {
  queryRef: ReturnType<typeof loadQuery<projectEvaluatorsLoaderQuery>>;
  /** The normalized (trimmed) name search the query was loaded with. */
  filter: string;
  /** The exact time range the query was loaded with. */
  timeRange: TimeRangeISOStrings;
  /** The exact score window the query was loaded with. */
  scoreWindow: EvaluatorScoreWindow;
  /** Whether the query fetched the mean score column's data. */
  includeMeanScore: boolean;
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
  const pageTimeRange = getPageTimeRange(url.searchParams);
  const timeRange: TimeRangeISOStrings = {
    start: pageTimeRange.start?.toISOString(),
    end: pageTimeRange.end?.toISOString(),
  };
  const scoreWindow = getEvaluatorScoreWindow({
    timeRange: pageTimeRange,
    utcOffsetMinutes: getUTCOffsetMinutes(),
  });
  const includeMeanScore = getStoredIncludeMeanScore();
  // The toolbar search lives in the URL, so the loader preloads the
  // already-filtered first page; the table refetches as the user types.
  // Trimmed the same way the table normalizes its variables, so the mount
  // guard's comparison sees the exact filter the rows were fetched with.
  const filter = url.searchParams.get(EVALUATOR_FILTER_PARAM)?.trim() ?? "";
  return {
    queryRef: loadQuery<projectEvaluatorsLoaderQuery>(
      RelayEnvironment,
      projectEvaluatorsLoaderGQL,
      {
        projectId,
        filter: filter ? { col: "name", value: filter } : null,
        timeRange,
        scoreTimeRange: scoreWindow.timeRange,
        scoreTimeBinConfig: scoreWindow.timeBinConfig,
        includeMeanScore,
      },
      { fetchPolicy: "store-and-network" }
    ),
    filter,
    timeRange,
    scoreWindow,
    includeMeanScore,
  };
}
