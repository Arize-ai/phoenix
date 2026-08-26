import type { Environment } from "react-relay";
import { fetchQuery, graphql } from "react-relay";

import { getEvaluatorCostTimeRange } from "@phoenix/pages/evaluators/evaluatorCostUtils";
import type { refetchProjectEvaluatorsQuery } from "@phoenix/pages/project/evaluators/__generated__/refetchProjectEvaluatorsQuery.graphql";

const PAGE_SIZE = 30;

const query = graphql`
  query refetchProjectEvaluatorsQuery(
    $projectId: ID!
    $first: Int!
    $costTimeRange: TimeRange
  ) {
    project: node(id: $projectId) {
      ... on Project {
        evaluatorCount
        evaluators(first: $first)
          @connection(key: "ProjectEvaluatorsTable_evaluators") {
          edges {
            node {
              ...ProjectEvaluatorsTable_row
                @arguments(costTimeRange: $costTimeRange)
            }
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }
  }
`;

export async function refetchProjectEvaluators({
  environment,
  projectId,
}: {
  environment: Environment;
  projectId: string;
}): Promise<void> {
  await fetchQuery<refetchProjectEvaluatorsQuery>(
    environment,
    query,
    {
      projectId,
      first: PAGE_SIZE,
      costTimeRange: getEvaluatorCostTimeRange(),
    },
    { fetchPolicy: "network-only" }
  ).toPromise();
}
