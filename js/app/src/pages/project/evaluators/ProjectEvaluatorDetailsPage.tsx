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
} from "@phoenix/components/datetime";
import { TopNavActions } from "@phoenix/components/nav";
import type { OwnedPreloadedQueryRef } from "@phoenix/hooks";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { projectEvaluatorDetailsLoaderQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorDetailsLoaderQuery.graphql";
import { LLMProjectEvaluatorDetails } from "@phoenix/pages/project/evaluators/LLMProjectEvaluatorDetails";
import type { projectEvaluatorDetailsLoader } from "@phoenix/pages/project/evaluators/projectEvaluatorDetailsLoader";
import { projectEvaluatorDetailsLoaderGQL } from "@phoenix/pages/project/evaluators/projectEvaluatorDetailsLoader";
import { ProjectEvaluatorEnabledSwitch } from "@phoenix/pages/project/evaluators/ProjectEvaluatorEnabledSwitch";
import { ProjectEvaluatorMetrics } from "@phoenix/pages/project/evaluators/ProjectEvaluatorMetrics";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import { ProjectEvaluatorRunDetails } from "@phoenix/pages/project/evaluators/ProjectEvaluatorRunDetails";
import { ProjectEvaluatorScopeDetails } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopeDetails";
import { ProjectEvaluatorTraces } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTraces";

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
            <Tab id="metrics">Metrics</Tab>
            <Tab id="traces">Traces</Tab>
          </TabList>
          <LazyTabPanel id="configuration">
            <View width="100%" overflow="auto" height="100%">
              <View padding="size-200">
                <Flex
                  direction="column"
                  gap="size-300"
                  maxWidth={1600}
                  marginStart="auto"
                  marginEnd="auto"
                >
                  <ProjectEvaluatorRunDetails
                    projectEvaluatorRef={projectEvaluator}
                  />
                  <ProjectEvaluatorScopeDetails
                    projectEvaluatorRef={projectEvaluator}
                  />
                  {isLLMEvaluator && (
                    <LLMProjectEvaluatorDetails
                      projectEvaluatorRef={projectEvaluator}
                    />
                  )}
                </Flex>
              </View>
            </View>
          </LazyTabPanel>
          <LazyTabPanel id="metrics">
            <Suspense fallback={<Loading />}>
              <ProjectEvaluatorMetrics
                projectEvaluatorId={projectEvaluator.id}
                evaluatedProjectId={projectEvaluator.project.id}
                traceProjectId={projectEvaluator.traceProject?.id ?? null}
                evaluatorName={projectEvaluator.name}
                evaluationTarget={projectEvaluator.evaluationTarget}
              />
            </Suspense>
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
