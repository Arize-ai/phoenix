import { css } from "@emotion/react";
import { graphql, useLazyLoadQuery } from "react-relay";
import invariant from "tiny-invariant";

import { Flex } from "@phoenix/components";
import type { ProjectEvaluatorCompareContentQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorCompareContentQuery.graphql";
import { ProjectEvaluatorCompareMatrix } from "@phoenix/pages/project/evaluators/ProjectEvaluatorCompareMatrix";
import { ProjectEvaluatorCompareStats } from "@phoenix/pages/project/evaluators/ProjectEvaluatorCompareStats";
import type { EvaluatorOptimizationDirection } from "@phoenix/types/evaluators";

import { ProjectEvaluatorCompareDistributions } from "./ProjectEvaluatorCompareDistributions";

const comparisonPanelsCSS = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-200);
  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export function ProjectEvaluatorCompareContent({
  projectId,
  evaluatorAId,
  evaluatorBId,
  evaluatorAName,
  evaluatorBName,
  evaluatorAOptimizationDirection,
  evaluatorBOptimizationDirection,
  timeRange,
}: {
  projectId: string;
  evaluatorAId: string;
  evaluatorBId: string;
  evaluatorAName: string;
  evaluatorBName: string;
  evaluatorAOptimizationDirection: EvaluatorOptimizationDirection | null;
  evaluatorBOptimizationDirection: EvaluatorOptimizationDirection | null;
  timeRange: TimeRange;
}) {
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
              ...ProjectEvaluatorCompareDistributions_comparison
              ...ProjectEvaluatorCompareMatrix_comparison
            }
          }
        }
      }
    `,
    {
      projectId,
      evaluatorAId,
      evaluatorBId,
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
    },
    { fetchPolicy: "store-and-network" }
  );
  invariant(data.project?.__typename === "Project", "project is required");
  const comparison = data.project.evaluatorComparison;
  return (
    <Flex direction="column" gap="size-200">
      <ProjectEvaluatorCompareStats
        comparisonRef={comparison}
        evaluatorAName={evaluatorAName}
        evaluatorBName={evaluatorBName}
      />
      <div css={comparisonPanelsCSS}>
        <ProjectEvaluatorCompareMatrix
          comparisonRef={comparison}
          evaluatorAName={evaluatorAName}
          evaluatorBName={evaluatorBName}
          evaluatorAOptimizationDirection={evaluatorAOptimizationDirection}
          evaluatorBOptimizationDirection={evaluatorBOptimizationDirection}
        />
        <ProjectEvaluatorCompareDistributions
          comparisonRef={comparison}
          evaluatorAId={evaluatorAId}
          evaluatorBId={evaluatorBId}
          evaluatorAName={evaluatorAName}
          evaluatorBName={evaluatorBName}
          evaluatorAOptimizationDirection={evaluatorAOptimizationDirection}
          evaluatorBOptimizationDirection={evaluatorBOptimizationDirection}
        />
      </div>
    </Flex>
  );
}
