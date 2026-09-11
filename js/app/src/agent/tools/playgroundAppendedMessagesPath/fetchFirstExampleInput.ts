import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { fetchFirstExampleInputQuery } from "./__generated__/fetchFirstExampleInputQuery.graphql";

/**
 * The `input` object of the loaded dataset's first example, or null when it
 * cannot be determined (unknown dataset, no examples). Used to validate the
 * appended-messages path at set-time; callers treat null as "cannot
 * validate", never as a failure.
 */
export async function fetchFirstExampleInput(
  datasetId: string
): Promise<unknown | null> {
  const data = await fetchQuery<fetchFirstExampleInputQuery>(
    RelayEnvironment,
    graphql`
      query fetchFirstExampleInputQuery($datasetId: ID!) {
        dataset: node(id: $datasetId) {
          __typename
          ... on Dataset {
            examples(first: 1) {
              edges {
                node {
                  revision {
                    input
                  }
                }
              }
            }
          }
        }
      }
    `,
    { datasetId },
    { fetchPolicy: "network-only" }
  ).toPromise();

  if (data?.dataset?.__typename !== "Dataset") {
    return null;
  }
  return data.dataset.examples.edges[0]?.node.revision.input ?? null;
}
