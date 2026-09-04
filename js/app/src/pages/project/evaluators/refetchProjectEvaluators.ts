import type { Environment } from "react-relay";
import { fetchQuery, graphql } from "react-relay";

import type { TimeRangeISOStrings } from "@phoenix/components/datetime";
import type { refetchProjectEvaluatorsQuery } from "@phoenix/pages/project/evaluators/__generated__/refetchProjectEvaluatorsQuery.graphql";

const PAGE_SIZE = 30;

const query = graphql`
  query refetchProjectEvaluatorsQuery(
    $projectId: ID!
    $first: Int!
    $timeRange: TimeRange!
  ) {
    project: node(id: $projectId) {
      ... on Project {
        evaluatorCount
        evaluators(first: $first)
          @connection(key: "ProjectEvaluatorsTable_evaluators") {
          edges {
            node {
              ...ProjectEvaluatorsTable_row
              ...ProjectEvaluatorsTable_costs @arguments(timeRange: $timeRange)
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
  timeRange,
}: {
  environment: Environment;
  projectId: string;
  timeRange: TimeRangeISOStrings;
}): Promise<void> {
  await fetchQuery<refetchProjectEvaluatorsQuery>(
    environment,
    query,
    {
      projectId,
      first: PAGE_SIZE,
      timeRange,
    },
    { fetchPolicy: "network-only" }
  ).toPromise();
}
