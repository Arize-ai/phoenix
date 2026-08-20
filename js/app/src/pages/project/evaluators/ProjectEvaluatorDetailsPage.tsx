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
import { Token } from "@phoenix/components/core/token";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import {
  ConnectedTimeRangeSelector,
  TimeRangeProvider,
} from "@phoenix/components/datetime";
import { TopNavActions } from "@phoenix/components/nav";
import type { OwnedPreloadedQueryRef } from "@phoenix/hooks";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { projectEvaluatorDetailsLoaderQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorDetailsLoaderQuery.graphql";
import { LLMProjectEvaluatorAnnotation } from "@phoenix/pages/project/evaluators/LLMProjectEvaluatorAnnotation";
import { LLMProjectEvaluatorDetails } from "@phoenix/pages/project/evaluators/LLMProjectEvaluatorDetails";
import type { projectEvaluatorDetailsLoader } from "@phoenix/pages/project/evaluators/projectEvaluatorDetailsLoader";
import { projectEvaluatorDetailsLoaderGQL } from "@phoenix/pages/project/evaluators/projectEvaluatorDetailsLoader";
import { ProjectEvaluatorEnabledSwitch } from "@phoenix/pages/project/evaluators/ProjectEvaluatorEnabledSwitch";
import { ProjectEvaluatorMetrics } from "@phoenix/pages/project/evaluators/ProjectEvaluatorMetrics";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import { ProjectEvaluatorRunDetails } from "@phoenix/pages/project/evaluators/ProjectEvaluatorRunDetails";
import { ProjectEvaluatorScopeDetails } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopeDetails";
import { ProjectEvaluatorTraces } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTraces";
import { getProjectEvaluatorStatus } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/**
 * The overview column: a container so the panels inside can respond to the
 * column's width rather than the viewport's, and centered with the same max
 * width the metrics tab uses.
 */
const overviewColumnCSS = css`
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-300);
  max-width: 1600px;
  margin-inline: auto;
`;

/**
 * Scope and Annotation are peers -- the policy that selects work and the
 * annotation that work produces -- so they sit side by side, stacking when the
 * column is too narrow to read two cards across.
 */
const configurationPairCSS = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-200);
  /* Stretch so the pair reads as one band rather than two ragged columns. */
  align-items: stretch;

  @container (max-width: 800px) {
    grid-template-columns: minmax(0, 1fr);
  }
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
  const navigate = useNavigate();
  const paths = useProjectEvaluatorPaths();
  // A shared trace link opens the drawer over this page, so the tab behind it
  // is the one the link came from -- and the one closing the drawer returns to.
  const { traceId } = useParams();
  const data = useOwnedPreloadedQuery<projectEvaluatorDetailsLoaderQuery>({
    query: projectEvaluatorDetailsLoaderGQL,
    queryRef,
  });
  const projectEvaluator = data.projectEvaluator;
  if (projectEvaluator?.__typename !== "ProjectEvaluator") {
    return <ProjectEvaluatorNotFound />;
  }
  const evaluator = projectEvaluator.evaluator;
  const status = getProjectEvaluatorStatus({
    schedulabilityStatus: projectEvaluator.schedulabilityStatus,
    schedulabilityReason: projectEvaluator.schedulabilityReason,
    runSummary: projectEvaluator.runSummary,
  });
  const isLLMEvaluator = evaluator.kind === "LLM";
  const canEdit = evaluator.kind === "LLM" || evaluator.kind === "CODE";

  return (
    // A local provider keeps this page's time range from writing the one shared
    // across the projects subtree (the dataset evaluator page does the same).
    <TimeRangeProvider>
      <main css={mainCSS}>
        <TopNavActions>
          <ConnectedTimeRangeSelector size="S" />
        </TopNavActions>
        <PageHeader
          title={
            <Flex direction="row" gap="size-150" alignItems="center">
              <Heading level={1}>
                <Truncate
                  maxWidth="100%"
                  title={`Evaluator: ${projectEvaluator.name}`}
                >{`Evaluator: ${projectEvaluator.name}`}</Truncate>
              </Heading>
              <Token color={status.color}>{status.label}</Token>
            </Flex>
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
                <div css={overviewColumnCSS}>
                  <ProjectEvaluatorRunDetails
                    projectEvaluatorRef={projectEvaluator}
                  />
                  <div css={configurationPairCSS}>
                    <ProjectEvaluatorScopeDetails
                      projectEvaluatorRef={projectEvaluator}
                    />
                    {isLLMEvaluator && (
                      <LLMProjectEvaluatorAnnotation
                        projectEvaluatorRef={projectEvaluator}
                      />
                    )}
                  </div>
                  {isLLMEvaluator && (
                    <LLMProjectEvaluatorDetails
                      projectEvaluatorRef={projectEvaluator}
                    />
                  )}
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
              <ProjectEvaluatorMetrics projectEvaluator={projectEvaluator} />
            </Suspense>
          </LazyTabPanel>
        </Tabs>
        {/* The edit slideover route renders over the page. */}
        <Suspense>
          <Outlet />
        </Suspense>
      </main>
    </TimeRangeProvider>
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
