import { css } from "@emotion/react";
import { Suspense } from "react";
import { Outlet, useLoaderData, useNavigate, useParams } from "react-router";
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
  Tab,
  TabList,
  Tabs,
  Text,
  View,
} from "@phoenix/components";
import { Empty } from "@phoenix/components/core/empty";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import {
  ConnectedTimeRangeSelector,
  TimeRangeProvider,
  useTimeRange,
} from "@phoenix/components/datetime";
import {
  evaluatorSplitContainerCSS,
  evaluatorSplitLayoutCSS,
} from "@phoenix/components/evaluators/EvaluatorDetailsSection";
import { TopNavActions } from "@phoenix/components/nav";
import type { OwnedPreloadedQueryRef } from "@phoenix/hooks";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { projectEvaluatorDetailsLoaderQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorDetailsLoaderQuery.graphql";
import { AnnotationConfigurationCard } from "@phoenix/pages/project/evaluators/AnnotationConfigurationCard";
import { CodeProjectEvaluatorDetails } from "@phoenix/pages/project/evaluators/CodeProjectEvaluatorDetails";
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

export function ProjectEvaluatorDetailsPage() {
  const loaderData = useLoaderData<typeof projectEvaluatorDetailsLoader>();
  invariant(loaderData, "loaderData is required");
  if (loaderData.queryRef == null) {
    return <ProjectEvaluatorNotFound />;
  }
  return <ProjectEvaluatorDetailsPageLoaded queryRef={loaderData.queryRef} />;
}

function ProjectEvaluatorDetailsPageLoaded({
  queryRef,
}: {
  queryRef: OwnedPreloadedQueryRef<projectEvaluatorDetailsLoaderQuery>;
}) {
  return (
    // A local provider keeps this page's time range from writing the one shared
    // across the projects subtree (the dataset evaluator page does the same).
    // The content is a child so it can read the provider's context.
    <TimeRangeProvider>
      <ProjectEvaluatorDetailsPageContent queryRef={queryRef} />
    </TimeRangeProvider>
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
  if (projectEvaluator?.__typename !== "ProjectEvaluator") {
    return <ProjectEvaluatorNotFound />;
  }
  const evaluator = projectEvaluator.evaluator;
  const isLLMEvaluator = evaluator.kind === "LLM";
  const canEdit = evaluator.kind === "LLM" || evaluator.kind === "CODE";

  return (
    <main css={mainCSS}>
      <TopNavActions>
        <ConnectedTimeRangeSelector size="S" />
      </TopNavActions>
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
      <Tabs defaultSelectedKey={traceId ? "traces" : "configuration"}>
        <TabList>
          {/* The key stays `configuration` -- it is the tab's identity, not its
              label, and a Traces deep link selects by it. */}
          <Tab id="configuration">Overview</Tab>
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
                    {evaluator.kind === "CODE" && (
                      <CodeProjectEvaluatorDetails
                        projectEvaluatorRef={projectEvaluator}
                      />
                    )}
                  </div>
                  <aside css={overviewColumnCSS}>
                    <ProjectEvaluatorScopeDetails
                      projectEvaluatorRef={projectEvaluator}
                    />
                    {isLLMEvaluator && (
                      <AnnotationConfigurationCard
                        projectEvaluatorRef={projectEvaluator}
                      />
                    )}
                  </aside>
                </div>
              </div>
            </View>
          </View>
        </LazyTabPanel>
        <LazyTabPanel id="traces">
          <Suspense fallback={<Loading />}>
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
      {/* The edit slideover route renders over the page. */}
      <Suspense>
        <Outlet />
      </Suspense>
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
