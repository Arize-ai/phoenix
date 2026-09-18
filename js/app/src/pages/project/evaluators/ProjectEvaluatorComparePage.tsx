import { css } from "@emotion/react";
import { Suspense, useDeferredValue } from "react";
import { Outlet, useLoaderData, useNavigate, useParams } from "react-router";
import invariant from "tiny-invariant";

import {
  Alert,
  Button,
  Flex,
  Heading,
  Icon,
  IconButton,
  Icons,
  Link,
  Loading,
  PageHeader,
  Text,
  View,
} from "@phoenix/components";
import { toAnnotationOptimizationConfig } from "@phoenix/components/annotation";
import { Empty } from "@phoenix/components/core/empty";
import {
  ConnectedTimeRangeSelector,
  TimeRangeProvider,
} from "@phoenix/components/datetime";
import { ErrorBoundary } from "@phoenix/components/exception";
import type { ErrorBoundaryFallbackProps } from "@phoenix/components/exception/types";
import { TopNavActions } from "@phoenix/components/nav";
import type { OwnedPreloadedQueryRef } from "@phoenix/hooks";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { projectEvaluatorCompareLoaderQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorCompareLoaderQuery.graphql";
import { ProjectEvaluatorCompareContent } from "@phoenix/pages/project/evaluators/ProjectEvaluatorCompareContent";
import type {
  projectEvaluatorCompareLoader,
  ProjectEvaluatorCompareInvalidReason,
} from "@phoenix/pages/project/evaluators/projectEvaluatorCompareLoader";
import { projectEvaluatorCompareLoaderGQL } from "@phoenix/pages/project/evaluators/projectEvaluatorCompareLoader";
import { ProjectEvaluatorCompareSelect } from "@phoenix/pages/project/evaluators/ProjectEvaluatorCompareSelect";
import { EVALUATOR_COMPARE_COLORS } from "@phoenix/pages/project/evaluators/projectEvaluatorCompareUtils";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import { useClosedTimeRange } from "@phoenix/pages/project/metrics/useClosedTimeRange";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

const mainCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
`;

const scrollCSS = css`
  height: 100%;
  overflow: auto;
  scrollbar-gutter: stable;
`;

const contentCSS = css`
  max-width: 1600px;
  margin-inline: auto;
  min-width: 0;
`;

export function ProjectEvaluatorComparePage() {
  const loaderData = useLoaderData<typeof projectEvaluatorCompareLoader>();
  invariant(loaderData, "loaderData is required");
  if (loaderData.invalidReason || !loaderData.queryRef) {
    return <ProjectEvaluatorCompareInvalid reason={loaderData.invalidReason} />;
  }
  return (
    <TimeRangeProvider>
      <ProjectEvaluatorComparePageLoaded queryRef={loaderData.queryRef} />
    </TimeRangeProvider>
  );
}

function ProjectEvaluatorComparePageLoaded({
  queryRef,
}: {
  queryRef: OwnedPreloadedQueryRef<projectEvaluatorCompareLoaderQuery>;
}) {
  const navigate = useNavigate();
  const paths = useProjectEvaluatorPaths();
  const { projectId } = useParams();
  invariant(projectId, "projectId is required");
  const data = useOwnedPreloadedQuery<projectEvaluatorCompareLoaderQuery>({
    query: projectEvaluatorCompareLoaderGQL,
    queryRef,
  });
  // Freeze an open-ended range above the Suspense boundary. If the querying
  // child owned this hook, every suspended retry would remount it with a new
  // `now` and issue a different request indefinitely.
  const timeRange = useClosedTimeRange();
  // A live range's "now" advances every minute or hour. Deferring it keeps the
  // current comparison mounted while the refreshed queries load, rather than
  // remounting the keyed subtree into a spinner that collapses the page's
  // scroll height and jumps the viewport. The Suspense boundary below is keyed
  // on the pair alone, so a different comparison still shows the loading state
  // at once.
  const deferredTimeRange = useDeferredValue(timeRange);
  const evaluatorA =
    data.evaluatorA?.__typename === "ProjectEvaluator" ? data.evaluatorA : null;
  const evaluatorB =
    data.evaluatorB?.__typename === "ProjectEvaluator" ? data.evaluatorB : null;
  if (!evaluatorA || !evaluatorB) {
    return <ProjectEvaluatorCompareInvalid reason="not-found" />;
  }
  const compatibleEvaluators =
    data.project?.__typename === "Project"
      ? data.project.evaluators.edges
          .map(({ evaluator }) => evaluator)
          .filter(
            (evaluator) =>
              evaluator.evaluationTarget === evaluatorA.evaluationTarget
          )
      : [evaluatorA, evaluatorB];
  const evaluatorAOptimizationDirection =
    evaluatorA.evaluator.outputConfigs[0]?.optimizationDirection ?? null;
  const evaluatorBOptimizationDirection =
    evaluatorB.evaluator.outputConfigs[0]?.optimizationDirection ?? null;
  const evaluatorAOptimizationConfig = toAnnotationOptimizationConfig(
    evaluatorA.evaluator.outputConfigs[0] ?? {}
  );
  const evaluatorBOptimizationConfig = toAnnotationOptimizationConfig(
    evaluatorB.evaluator.outputConfigs[0] ?? {}
  );
  const pairKey = `${evaluatorA.id}:${evaluatorB.id}`;
  const comparisonKey = [
    pairKey,
    deferredTimeRange.start.toISOString(),
    deferredTimeRange.end.toISOString(),
  ].join(":");

  return (
    <main css={mainCSS}>
      <TopNavActions>
        <ConnectedTimeRangeSelector size="S" />
      </TopNavActions>
      <PageHeader
        title={<Heading level={1}>Compare evaluators</Heading>}
        subTitle="Compare evaluator judgments, result distributions, and coverage"
        extra={
          <Flex direction="row" alignItems="center" gap="size-100">
            <ProjectEvaluatorCompareSelect
              label="Select evaluator A"
              color={EVALUATOR_COMPARE_COLORS.a}
              selectedEvaluator={evaluatorA}
              options={compatibleEvaluators.filter(
                (evaluator) => evaluator.id !== evaluatorB.id
              )}
              onSelectionChange={(evaluatorId) =>
                navigate(paths.compare({ a: evaluatorId, b: evaluatorB.id }))
              }
            />
            <IconButton
              size="S"
              aria-label="Swap evaluators"
              onPress={() =>
                navigate(paths.compare({ a: evaluatorB.id, b: evaluatorA.id }))
              }
            >
              <Icon svg={<Icons.Repeat />} />
            </IconButton>
            <ProjectEvaluatorCompareSelect
              label="Select evaluator B"
              color={EVALUATOR_COMPARE_COLORS.b}
              selectedEvaluator={evaluatorB}
              options={compatibleEvaluators.filter(
                (evaluator) => evaluator.id !== evaluatorA.id
              )}
              onSelectionChange={(evaluatorId) =>
                navigate(paths.compare({ a: evaluatorA.id, b: evaluatorId }))
              }
            />
          </Flex>
        }
      />
      <div css={scrollCSS}>
        <View padding="size-200">
          <div css={contentCSS}>
            <Suspense key={pairKey} fallback={<Loading />}>
              <ErrorBoundary
                key={comparisonKey}
                fallback={ProjectEvaluatorCompareErrorFallback}
              >
                <ProjectEvaluatorCompareContent
                  projectId={projectId}
                  evaluatorAId={evaluatorA.id}
                  evaluatorBId={evaluatorB.id}
                  evaluatorAName={evaluatorA.name}
                  evaluatorBName={evaluatorB.name}
                  evaluatorAOptimizationDirection={
                    evaluatorAOptimizationDirection
                  }
                  evaluatorBOptimizationDirection={
                    evaluatorBOptimizationDirection
                  }
                  evaluatorAOptimizationConfig={evaluatorAOptimizationConfig}
                  evaluatorBOptimizationConfig={evaluatorBOptimizationConfig}
                  timeRange={deferredTimeRange}
                />
              </ErrorBoundary>
            </Suspense>
          </div>
        </View>
      </div>
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </main>
  );
}

const invalidMessages: Record<ProjectEvaluatorCompareInvalidReason, string> = {
  missing: "Choose two evaluators to compare.",
  same: "Choose two different evaluators to compare.",
  "not-found": "One or both evaluators do not exist or have been deleted.",
  "other-project": "Both evaluators must belong to this project.",
  "different-target":
    "Both evaluators must evaluate the same target (span, trace, or session).",
};

function ProjectEvaluatorCompareInvalid({
  reason,
}: {
  reason: ProjectEvaluatorCompareInvalidReason | null;
}) {
  const navigate = useNavigate();
  const paths = useProjectEvaluatorPaths();
  return (
    <main>
      <View paddingTop="size-1000">
        <Flex direction="column" alignItems="center" gap="size-200">
          <Empty
            message={
              reason
                ? invalidMessages[reason]
                : "These evaluators cannot be compared."
            }
          />
          <Button onPress={() => navigate(paths.list)}>
            Back to evaluators
          </Button>
        </Flex>
      </View>
    </main>
  );
}

function ProjectEvaluatorCompareErrorFallback({
  error,
}: ErrorBoundaryFallbackProps) {
  const paths = useProjectEvaluatorPaths();
  const serverMessages = getErrorMessagesFromRelayMutationError(
    error ? new Error(error) : null
  );
  return (
    <Alert variant="danger" title="Could not compare evaluators">
      <Flex direction="column" gap="size-100">
        <Text size="S">
          {serverMessages?.join("\n") ??
            error ??
            "The comparison could not be loaded."}
        </Text>
        <Link to={paths.list}>Back to evaluators</Link>
      </Flex>
    </Alert>
  );
}
