import type { Environment } from "react-relay";
import { fetchQuery, graphql } from "react-relay";

import type { refetchProjectEvaluatorsQuery } from "@phoenix/pages/project/evaluators/__generated__/refetchProjectEvaluatorsQuery.graphql";

const PAGE_SIZE = 30;

const query = graphql`
  query refetchProjectEvaluatorsQuery($projectId: ID!, $first: Int!) {
    project: node(id: $projectId) {
      ... on Project {
        evaluators(first: $first)
          @connection(key: "ProjectEvaluatorsTable_evaluators") {
          edges {
            node {
              ...ProjectEvaluatorsTable_row
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
    { projectId, first: PAGE_SIZE },
    { fetchPolicy: "network-only" }
  ).toPromise();
}
