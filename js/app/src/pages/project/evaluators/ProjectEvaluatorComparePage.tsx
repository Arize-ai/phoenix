import { css } from "@emotion/react";
import { Suspense } from "react";
import { useLoaderData, useNavigate, useParams } from "react-router";
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
  Token,
  View,
} from "@phoenix/components";
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
  const evaluatorA =
    data.evaluatorA?.__typename === "ProjectEvaluator" ? data.evaluatorA : null;
  const evaluatorB =
    data.evaluatorB?.__typename === "ProjectEvaluator" ? data.evaluatorB : null;
  if (!evaluatorA || !evaluatorB) {
    return <ProjectEvaluatorCompareInvalid reason="not-found" />;
  }

  return (
    <main css={mainCSS}>
      <TopNavActions>
        <ConnectedTimeRangeSelector size="S" />
      </TopNavActions>
      <PageHeader
        title={<Heading level={1}>Compare evaluators</Heading>}
        subTitle="Where two evaluators agree, disagree, and drift over the same telemetry"
        extra={
          <Flex direction="row" alignItems="center" gap="size-100">
            <Token color={EVALUATOR_COMPARE_COLORS.a} maxWidth="240px">
              {evaluatorA.name}
            </Token>
            <IconButton
              size="S"
              aria-label="Swap evaluators"
              onPress={() =>
                navigate(paths.compare({ a: evaluatorB.id, b: evaluatorA.id }))
              }
            >
              <Icon svg={<Icons.Repeat />} />
            </IconButton>
            <Token color={EVALUATOR_COMPARE_COLORS.b} maxWidth="240px">
              {evaluatorB.name}
            </Token>
          </Flex>
        }
      />
      <View overflow="auto" height="100%">
        <View padding="size-200">
          <div css={contentCSS}>
            <ErrorBoundary fallback={ProjectEvaluatorCompareErrorFallback}>
              <Suspense fallback={<Loading />}>
                <ProjectEvaluatorCompareContent
                  projectId={projectId}
                  evaluatorAId={evaluatorA.id}
                  evaluatorBId={evaluatorB.id}
                  evaluatorAName={evaluatorA.name}
                  evaluatorBName={evaluatorB.name}
                  timeRange={timeRange}
                />
              </Suspense>
            </ErrorBoundary>
          </div>
        </View>
      </View>
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
