import { css } from "@emotion/react";
import { graphql, useFragment, useLazyLoadQuery } from "react-relay";
import invariant from "tiny-invariant";

import { Flex } from "@phoenix/components";
import type { ProjectEvaluatorCompareContent_evaluator$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorCompareContent_evaluator.graphql";
import type { ProjectEvaluatorCompareContentQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorCompareContentQuery.graphql";
import { ProjectEvaluatorCompareMatrix } from "@phoenix/pages/project/evaluators/ProjectEvaluatorCompareMatrix";
import { ProjectEvaluatorCompareStats } from "@phoenix/pages/project/evaluators/ProjectEvaluatorCompareStats";

import { ProjectEvaluatorCompareDistributions } from "./ProjectEvaluatorCompareDistributions";

const comparisonPanelsCSS = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-200);
  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
  }
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
        evaluatorA: node(id: $evaluatorAId) {
          __typename
          ... on ProjectEvaluator {
            ...ProjectEvaluatorCompareDistributions_evaluator
              @arguments(timeRange: $timeRange)
          }
        }
        evaluatorB: node(id: $evaluatorBId) {
          __typename
          ... on ProjectEvaluator {
            ...ProjectEvaluatorCompareDistributions_evaluator
              @arguments(timeRange: $timeRange)
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
  invariant(
    data.evaluatorA?.__typename === "ProjectEvaluator",
    "evaluator A is required"
  );
  invariant(
    data.evaluatorB?.__typename === "ProjectEvaluator",
    "evaluator B is required"
  );
  const comparison = data.project.evaluatorComparison;
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
        <ProjectEvaluatorCompareDistributions
          evaluatorARef={data.evaluatorA}
          evaluatorBRef={data.evaluatorB}
        />
      </div>
    </Flex>
  );
}
