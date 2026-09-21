import { css } from "@emotion/react";
import { graphql, useFragment, useLazyLoadQuery } from "react-relay";
import invariant from "tiny-invariant";

import { Card, Flex, Text, View } from "@phoenix/components";
import { Empty } from "@phoenix/components/core/empty";
import type { ProjectEvaluatorCompareContent_evaluator$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorCompareContent_evaluator.graphql";
import type { ProjectEvaluatorCompareContentQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorCompareContentQuery.graphql";
import { ProjectEvaluatorCompareMatrix } from "@phoenix/pages/project/evaluators/ProjectEvaluatorCompareMatrix";
import { ProjectEvaluatorCompareStats } from "@phoenix/pages/project/evaluators/ProjectEvaluatorCompareStats";
import { formatEvaluationTargetPlural } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { formatInt } from "@phoenix/utils/numberFormatUtils";

const comparisonPanelsCSS = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-200);
`;

const evaluatorFragment = graphql`
  fragment ProjectEvaluatorCompareContent_evaluator on ProjectEvaluator {
    id
    name
    ...ProjectEvaluatorCompareStats_evaluator
    ...ProjectEvaluatorCompareMatrix_evaluator
  }
`;

export function ProjectEvaluatorCompareContent({
  projectId,
  evaluatorARef,
  evaluatorBRef,
  timeRange,
}: {
  projectId: string;
  evaluatorARef: ProjectEvaluatorCompareContent_evaluator$key;
  evaluatorBRef: ProjectEvaluatorCompareContent_evaluator$key;
  timeRange: TimeRange;
}) {
  const evaluatorA = useFragment(evaluatorFragment, evaluatorARef);
  const evaluatorB = useFragment(evaluatorFragment, evaluatorBRef);
  const data = useLazyLoadQuery<ProjectEvaluatorCompareContentQuery>(
    graphql`
      query ProjectEvaluatorCompareContentQuery(
        $projectId: ID!
        $evaluatorAId: ID!
        $evaluatorBId: ID!
        $timeRange: TimeRange!
      ) {
        project: node(id: $projectId) {
          __typename
          ... on Project {
            evaluatorComparison(
              evaluatorAId: $evaluatorAId
              evaluatorBId: $evaluatorBId
              timeRange: $timeRange
            ) {
              evaluationTarget
              coverage {
                evaluatedByBoth
                onlyA
                onlyB
                totalInRange
              }
              ...ProjectEvaluatorCompareStats_comparison
              ...ProjectEvaluatorCompareMatrix_comparison
            }
          }
        }
      }
    `,
    {
      projectId,
      evaluatorAId: evaluatorA.id,
      evaluatorBId: evaluatorB.id,
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
    },
    { fetchPolicy: "store-and-network" }
  );
  invariant(data.project?.__typename === "Project", "project is required");
  const comparison = data.project.evaluatorComparison;
  const { coverage, evaluationTarget } = comparison;
  const targetPlural = formatEvaluationTargetPlural(evaluationTarget);

  if (coverage.evaluatedByBoth === 0) {
    return (
      <View paddingTop="size-1000">
        <Flex direction="column" alignItems="center" gap="size-100">
          <Empty
            message={`No ${targetPlural} evaluated by both ${evaluatorA.name} and ${evaluatorB.name} in this time range`}
          />
          <Text size="S" color="text-700">
            {evaluatorA.name} only: {formatInt(coverage.onlyA)} ·{" "}
            {evaluatorB.name} only: {formatInt(coverage.onlyB)} · Total in
            range: {formatInt(coverage.totalInRange)}
          </Text>
        </Flex>
      </View>
    );
  }

  return (
    <Flex direction="column" gap="size-200">
      <ProjectEvaluatorCompareStats
        comparisonRef={comparison}
        evaluatorARef={evaluatorA}
        evaluatorBRef={evaluatorB}
      />
      <div css={comparisonPanelsCSS}>
        <ProjectEvaluatorCompareMatrix
          comparisonRef={comparison}
          evaluatorARef={evaluatorA}
          evaluatorBRef={evaluatorB}
        />
        <Card title="TODO: score distributions" titleSeparator={false} />
      </div>
    </Flex>
  );
}
