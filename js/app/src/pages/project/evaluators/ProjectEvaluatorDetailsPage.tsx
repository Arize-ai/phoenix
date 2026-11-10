import { css } from "@emotion/react";
import { Suspense } from "react";
import {
  Outlet,
  useLoaderData,
  useMatches,
  useNavigate,
  useParams,
} from "react-router";
import invariant from "tiny-invariant";

import {
  Button,
  Flex,
  Heading,
  Icon,
  Icons,
  LazyTabPanel,
  Loading,
  PageHeader,
  Skeleton,
  Tab,
  TabList,
  Tabs,
  Text,
  View,
} from "@phoenix/components";
import { CHART_PANEL_STRIP_DEFAULT_HEIGHT_PIXELS } from "@phoenix/components/chart/ChartPanelStrip";
import { Counter } from "@phoenix/components/core/counter";
import { Empty } from "@phoenix/components/core/empty";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import {
  ConnectedTimeRangeSelector,
  TimeRangeProvider,
  useTimeRange,
} from "@phoenix/components/datetime";
import { CodeDatasetEvaluatorVersionsSkeleton } from "@phoenix/components/evaluators/CodeEvaluatorVersions";
import { evaluatorSplitLayoutCSS } from "@phoenix/components/evaluators/EvaluatorDetailsSection";
import {
  classifyServerConnectionError,
  ErrorBoundary,
  ServerConnectionErrorContent,
} from "@phoenix/components/exception";
import { BugReportErrorBoundaryFallback } from "@phoenix/components/exception/BugReportErrorBoundaryFallback";
import type { ErrorBoundaryFallbackProps } from "@phoenix/components/exception/types";
import { TopNavActions } from "@phoenix/components/nav";
import { TableSkeleton } from "@phoenix/components/table";
import type { OwnedPreloadedQueryRef } from "@phoenix/hooks";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { projectEvaluatorDetailsLoaderQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorDetailsLoaderQuery.graphql";
import { getClearableCount } from "@phoenix/pages/project/evaluators/evaluationQueueCounts";
import type { projectEvaluatorDetailsLoader } from "@phoenix/pages/project/evaluators/projectEvaluatorDetailsLoader";
import { projectEvaluatorDetailsLoaderGQL } from "@phoenix/pages/project/evaluators/projectEvaluatorDetailsLoader";
import type { ProjectEvaluatorDetailsOutletContext } from "@phoenix/pages/project/evaluators/projectEvaluatorDetailsOutletContext";
import { overviewContainerCSS } from "@phoenix/pages/project/evaluators/ProjectEvaluatorDetailsTabs";
import { ProjectEvaluatorEnabledSwitch } from "@phoenix/pages/project/evaluators/ProjectEvaluatorEnabledSwitch";
import {
  isProjectEvaluatorTab,
  PROJECT_EVALUATOR_TABS,
  type ProjectEvaluatorTab,
  projectEvaluatorTabRouteId,
  useProjectEvaluatorPaths,
} from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import { useClosedTimeRange } from "@phoenix/pages/project/metrics/useClosedTimeRange";
import { isServerUnreachableError } from "@phoenix/pages/redirects/notFound";

const mainCSS = css`
  display: flex;
  overflow: hidden;
  flex-direction: column;
  height: 100%;
  .tabs {
    flex: 1 1 auto;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    div[role="tablist"] {
      flex: none;
    }
  }
`;

/**
 * The tab whose route is matched. Each tab is a nested route, so the URL
 * selects it; the overview is the evaluator's own path.
 */
function useSelectedProjectEvaluatorTab(): ProjectEvaluatorTab {
  const matches = useMatches();
  return (
    PROJECT_EVALUATOR_TABS.find((tab) =>
      matches.some((match) => match.id === projectEvaluatorTabRouteId(tab))
    ) ?? "overview"
  );
}

export function ProjectEvaluatorDetailsPage() {
  const loaderData = useLoaderData<typeof projectEvaluatorDetailsLoader>();
  invariant(loaderData, "loaderData is required");
  const { projectEvaluatorId } = useParams();
  return (
    // A local provider keeps this page's time range from writing the one shared
    // across the projects subtree (the dataset evaluator page does the same).
    // The content is a child so it can read the provider's context.
    <TimeRangeProvider>
      {/* The loader does not wait for the evaluator, so the id in the URL
          is first checked here: one that names a deleted evaluator, or
          nothing at all, fails the query, and that failure is the not-found
          state. Only the lookup reaches this boundary; the content keeps
          its tabs' and drawers' failures to itself. The boundary resets
          when the id changes. */}
      <ErrorBoundary
        resetKey={projectEvaluatorId}
        fallback={ProjectEvaluatorLookupErrorFallback}
        isExpectedError={isLookupRejection}
      >
        <TopNavActions>
          <ConnectedTimeRangeSelector size="S" />
        </TopNavActions>
        <Suspense fallback={<ProjectEvaluatorDetailsPageSkeleton />}>
          <ProjectEvaluatorDetailsPageContent queryRef={loaderData.queryRef} />
        </Suspense>
      </ErrorBoundary>
    </TimeRangeProvider>
  );
}

/**
 * A lookup the server answered with an error is a rejection of the id, which
 * is the not-found state, as the other lookup loaders treat it. Only a
 * failure to reach the server says nothing about the evaluator.
 */
function isLookupRejection(thrown: unknown): boolean {
  return !isServerUnreachableError(thrown);
}

function ProjectEvaluatorLookupErrorFallback(
  props: ErrorBoundaryFallbackProps
) {
  if (isLookupRejection(props.thrown)) {
    return <ProjectEvaluatorNotFound />;
  }
  const connectionErrorKind = classifyServerConnectionError(props.thrown);
  if (connectionErrorKind != null) {
    return <ServerConnectionErrorContent kind={connectionErrorKind} />;
  }
  return <BugReportErrorBoundaryFallback {...props} />;
}

const OVERVIEW_MAIN_SKELETON_HEIGHT = 360;
const OVERVIEW_ASIDE_SKELETON_HEIGHT = 240;

/**
 * The page while the evaluator loads, in its loaded layout: the header's
 * title and description with the controls at its end, the tab list, then the
 * overview tab's stats strip over its main column and sidebar.
 */
function ProjectEvaluatorDetailsPageSkeleton() {
  return (
    <main css={mainCSS} role="status" aria-label="Loading evaluator">
      <View padding="size-200" flex="none">
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          gap="size-100"
        >
          <Flex direction="column" gap="size-50">
            <Skeleton height={24} width={320} />
            <Skeleton height={16} width={480} />
          </Flex>
          <Skeleton height={32} width={160} />
        </Flex>
      </View>
      <View paddingX="size-200" flex="none">
        <Skeleton height={32} width={320} />
      </View>
      <View padding="size-200">
        <div css={overviewContainerCSS}>
          <Skeleton
            height={CHART_PANEL_STRIP_DEFAULT_HEIGHT_PIXELS}
            borderRadius="medium"
          />
          <div css={evaluatorSplitLayoutCSS}>
            <Skeleton
              height={OVERVIEW_MAIN_SKELETON_HEIGHT}
              borderRadius="medium"
            />
            <Skeleton
              height={OVERVIEW_ASIDE_SKELETON_HEIGHT}
              borderRadius="medium"
            />
          </div>
        </div>
      </View>
    </main>
  );
}

function ProjectEvaluatorDetailsPageContent({
  queryRef,
}: {
  queryRef: OwnedPreloadedQueryRef<projectEvaluatorDetailsLoaderQuery>;
}) {
  const navigate = useNavigate();
  const paths = useProjectEvaluatorPaths();
  const selectedTab = useSelectedProjectEvaluatorTab();
  const data = useOwnedPreloadedQuery<projectEvaluatorDetailsLoaderQuery>({
    query: projectEvaluatorDetailsLoaderGQL,
    queryRef,
  });
  // Shared by the overview strip and the metrics tab; see the outlet context.
  const timeRange = useClosedTimeRange();
  const { setCustomTimeRange } = useTimeRange();
  const projectEvaluator = data.projectEvaluator;
  // An id of another node type, say a project's, resolves to that type
  // rather than failing: treat it as not found. Ids the server rejects are
  // caught by the boundary above.
  if (projectEvaluator?.__typename !== "ProjectEvaluator") {
    return <ProjectEvaluatorNotFound />;
  }
  const evaluator = projectEvaluator.evaluator;
  const isCodeEvaluator = evaluator.kind === "CODE";
  const canEdit =
    evaluator.kind === "LLM" ||
    isCodeEvaluator ||
    evaluator.kind === "DECISION";
  const versionCount = isCodeEvaluator ? (evaluator.versionCount ?? 0) : 0;

  const outletContext: ProjectEvaluatorDetailsOutletContext = {
    projectEvaluator,
    timeRange,
    onTimeRangeSelected: setCustomTimeRange,
  };
  return (
    <main css={mainCSS}>
      <PageHeader
        title={
          <Heading level={1}>
            <Truncate
              maxWidth="100%"
              title={`Evaluator: ${projectEvaluator.name}`}
            >{`Evaluator: ${projectEvaluator.name}`}</Truncate>
          </Heading>
        }
        subTitle={evaluator.description}
        extra={
          <Flex direction="row" alignItems="center" gap="size-200">
            <Flex direction="row" alignItems="center" gap="size-100">
              <Text size="S" color="text-700">
                Enabled
              </Text>
              <ProjectEvaluatorEnabledSwitch
                projectEvaluatorId={projectEvaluator.id}
                name={projectEvaluator.name}
                enabled={projectEvaluator.enabled}
                clearableCount={getClearableCount(projectEvaluator.runSummary)}
              />
            </Flex>
            {canEdit && (
              <Button
                variant="primary"
                // The slideover opens over the tab it was opened from.
                onPress={() =>
                  navigate(paths.edit(projectEvaluator.id, selectedTab))
                }
                leadingVisual={<Icon svg={<Icons.Edit />} />}
              >
                Edit
              </Button>
            )}
          </Flex>
        }
      />
      {/* The tabs and the drawers over them load on their own; their
          failures stay here rather than reading as the evaluator missing.
          Each tab is a nested route that renders through the outlet, along
          with the drawer or slideover nested under it. */}
      <ErrorBoundary>
        <Tabs
          selectedKey={selectedTab}
          onSelectionChange={(key) => {
            if (isProjectEvaluatorTab(key)) {
              navigate(paths.details(projectEvaluator.id, key));
            }
          }}
        >
          <TabList>
            <Tab id="overview">Overview</Tab>
            {isCodeEvaluator && (
              <Tab id="versions">
                Versions <Counter variant="quiet">{versionCount}</Counter>
              </Tab>
            )}
            <Tab id="traces">Traces</Tab>
            <Tab id="metrics">Metrics</Tab>
          </TabList>
          <LazyTabPanel id="overview">
            <Outlet context={outletContext} />
          </LazyTabPanel>
          {isCodeEvaluator && (
            <LazyTabPanel id="versions">
              <Suspense fallback={<CodeDatasetEvaluatorVersionsSkeleton />}>
                <Outlet context={outletContext} />
              </Suspense>
            </LazyTabPanel>
          )}
          <LazyTabPanel id="traces">
            <Suspense
              fallback={
                <TableSkeleton hasToolbar isSelectable rowCount="fill" />
              }
            >
              <Outlet context={outletContext} />
            </Suspense>
          </LazyTabPanel>
          <LazyTabPanel id="metrics">
            <Suspense fallback={<Loading />}>
              <Outlet context={outletContext} />
            </Suspense>
          </LazyTabPanel>
        </Tabs>
      </ErrorBoundary>
    </main>
  );
}

function ProjectEvaluatorNotFound() {
  const navigate = useNavigate();
  const paths = useProjectEvaluatorPaths();
  return (
    <main>
      <View paddingTop="size-1000">
        <Flex direction="column" alignItems="center" gap="size-200">
          <Empty message="This evaluator does not exist or has been deleted." />
          <Button onPress={() => navigate(paths.list)}>
            Back to evaluators
          </Button>
        </Flex>
      </View>
    </main>
  );
}
