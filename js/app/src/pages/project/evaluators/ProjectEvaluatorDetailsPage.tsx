import { css } from "@emotion/react";
import { Suspense } from "react";
import {
  Outlet,
  useLoaderData,
  useNavigate,
  useOutletContext,
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
import {
  CodeDatasetEvaluatorVersionsSkeleton,
  CodeEvaluatorVersions,
} from "@phoenix/components/evaluators/CodeEvaluatorVersions";
import {
  evaluatorSplitContainerCSS,
  evaluatorSplitLayoutCSS,
} from "@phoenix/components/evaluators/EvaluatorDetailsSection";
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
import { AnnotationConfigurationCard } from "@phoenix/pages/project/evaluators/AnnotationConfigurationCard";
import { CodeProjectEvaluatorConfigCards } from "@phoenix/pages/project/evaluators/CodeProjectEvaluatorConfigCards";
import { CodeProjectEvaluatorDetails } from "@phoenix/pages/project/evaluators/CodeProjectEvaluatorDetails";
import { DecisionProjectEvaluatorDetails } from "@phoenix/pages/project/evaluators/DecisionProjectEvaluatorDetails";
import { getClearableCount } from "@phoenix/pages/project/evaluators/evaluationQueueCounts";
import { LLMProjectEvaluatorDetails } from "@phoenix/pages/project/evaluators/LLMProjectEvaluatorDetails";
import type { projectEvaluatorDetailsLoader } from "@phoenix/pages/project/evaluators/projectEvaluatorDetailsLoader";
import { projectEvaluatorDetailsLoaderGQL } from "@phoenix/pages/project/evaluators/projectEvaluatorDetailsLoader";
import { ProjectEvaluatorEnabledSwitch } from "@phoenix/pages/project/evaluators/ProjectEvaluatorEnabledSwitch";
import { ProjectEvaluatorMetrics } from "@phoenix/pages/project/evaluators/ProjectEvaluatorMetrics";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import { ProjectEvaluatorScopeDetails } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopeDetails";
import { ProjectEvaluatorStats } from "@phoenix/pages/project/evaluators/ProjectEvaluatorStats";
import { ProjectEvaluatorTraces } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTraces";
import { useClosedTimeRange } from "@phoenix/pages/project/metrics/useClosedTimeRange";
import { isServerUnreachableError } from "@phoenix/pages/redirects/notFound";

/**
 * Centers the overview and establishes the width queried by its responsive
 * main-and-sidebar layout. Stacks the stats strip above the split layout.
 */
const overviewContainerCSS = css`
  ${evaluatorSplitContainerCSS};
  max-width: 1600px;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
`;

const overviewColumnCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
  min-width: 0;
`;

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

/** What the routes nested under the details page read from it through the outlet. */
type ProjectEvaluatorDetailsOutletContext = {
  /** The evaluator's own trace project, where the traces its runs produce live. */
  traceProjectId: string;
};

/**
 * The details page's outlet context, for the routes it renders over itself.
 * `useOutletContext` takes the caller's word for the type, so the one place
 * that names it is next to the outlet that provides it.
 */
export function useProjectEvaluatorDetailsOutletContext() {
  return useOutletContext<ProjectEvaluatorDetailsOutletContext>();
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
  // A shared trace link opens the drawer over this page, so the tab behind it
  // is the one the link came from -- and the one closing the drawer returns to.
  const { traceId } = useParams();
  const data = useOwnedPreloadedQuery<projectEvaluatorDetailsLoaderQuery>({
    query: projectEvaluatorDetailsLoaderGQL,
    queryRef,
  });
  // One closed time range shared by the overview strip and the metrics tab;
  // independently frozen ranges would close a live range at different instants
  // and turn identical chart queries into cache misses on tab switches.
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
  const isLLMEvaluator = evaluator.kind === "LLM";
  const isCodeEvaluator = evaluator.kind === "CODE";
  const isDecisionEvaluator = evaluator.kind === "DECISION";
  const canEdit = isLLMEvaluator || isCodeEvaluator || isDecisionEvaluator;
  const codeEvaluatorId = isCodeEvaluator ? evaluator.id : undefined;
  const versionCount = isCodeEvaluator ? (evaluator.versionCount ?? 0) : 0;

  const outletContext: ProjectEvaluatorDetailsOutletContext = {
    traceProjectId: projectEvaluator.traceProject.id,
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
                onPress={() => navigate(paths.edit(projectEvaluator.id))}
                leadingVisual={<Icon svg={<Icons.Edit />} />}
              >
                Edit
              </Button>
            )}
          </Flex>
        }
      />
      {/* The tabs and the drawers over them load on their own; their
          failures stay here rather than reading as the evaluator missing. */}
      <ErrorBoundary>
        <Tabs defaultSelectedKey={traceId ? "traces" : "configuration"}>
          <TabList>
            {/* The key stays `configuration` -- it is the tab's identity, not its
              label, and a Traces deep link selects by it. */}
            <Tab id="configuration">Overview</Tab>
            {codeEvaluatorId != null && (
              <Tab id="versions">
                Versions <Counter variant="quiet">{versionCount}</Counter>
              </Tab>
            )}
            <Tab id="traces">Traces</Tab>
            <Tab id="metrics">Metrics</Tab>
          </TabList>
          <LazyTabPanel id="configuration">
            <View width="100%" overflow="auto" height="100%">
              <View padding="size-200">
                <div css={overviewContainerCSS}>
                  <ProjectEvaluatorStats
                    projectEvaluatorRef={projectEvaluator}
                    timeRange={timeRange}
                    onTimeRangeSelected={setCustomTimeRange}
                  />
                  <div css={evaluatorSplitLayoutCSS}>
                    <div css={overviewColumnCSS}>
                      {isLLMEvaluator && (
                        <LLMProjectEvaluatorDetails
                          projectEvaluatorRef={projectEvaluator}
                        />
                      )}
                      {isCodeEvaluator && (
                        <CodeProjectEvaluatorDetails
                          projectEvaluatorRef={projectEvaluator}
                        />
                      )}
                      {isDecisionEvaluator && (
                        <DecisionProjectEvaluatorDetails
                          projectEvaluatorRef={projectEvaluator}
                        />
                      )}
                    </div>
                    <aside css={overviewColumnCSS}>
                      <ProjectEvaluatorScopeDetails
                        projectEvaluatorRef={projectEvaluator}
                      />
                      <AnnotationConfigurationCard
                        projectEvaluatorRef={projectEvaluator}
                      />
                      {isCodeEvaluator && (
                        <CodeProjectEvaluatorConfigCards
                          projectEvaluatorRef={projectEvaluator}
                        />
                      )}
                    </aside>
                  </div>
                </div>
              </View>
            </View>
          </LazyTabPanel>
          {codeEvaluatorId != null && (
            <LazyTabPanel id="versions">
              <Suspense fallback={<CodeDatasetEvaluatorVersionsSkeleton />}>
                <CodeEvaluatorVersions codeEvaluatorId={codeEvaluatorId} />
              </Suspense>
            </LazyTabPanel>
          )}
          <LazyTabPanel id="traces">
            <Suspense
              fallback={
                <TableSkeleton hasToolbar isSelectable rowCount="fill" />
              }
            >
              <ProjectEvaluatorTraces
                projectId={projectEvaluator.traceProject.id}
                projectEvaluatorId={projectEvaluator.id}
                hasEverRun={projectEvaluator.runSummary.status !== "NEVER_RUN"}
              />
            </Suspense>
          </LazyTabPanel>
          <LazyTabPanel id="metrics">
            <Suspense fallback={<Loading />}>
              <ProjectEvaluatorMetrics
                projectEvaluator={projectEvaluator}
                timeRange={timeRange}
                onTimeRangeSelected={setCustomTimeRange}
              />
            </Suspense>
          </LazyTabPanel>
        </Tabs>
        {/* The edit slideover and trace drawer routes render over the page. */}
        <Suspense>
          <Outlet context={outletContext} />
        </Suspense>
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
