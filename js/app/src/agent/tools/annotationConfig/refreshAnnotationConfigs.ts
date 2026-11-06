import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { refreshAnnotationConfigsQuery } from "./__generated__/refreshAnnotationConfigsQuery.graphql";

/**
 * Re-read the root `annotationConfigs` list over the network after a config
 * is created or updated.
 *
 * A `query { ...AnnotationConfigTableFragment }` selection inside a mutation
 * payload does not do this: Relay normalizes it under the mutation's own
 * client record (`client:local:N:createAnnotationConfig(...):query`), not
 * `client:root`, so the settings table, the project config card and the span
 * annotation editor keep rendering the old list. Fetching the root field
 * directly, with every node shape those consumers select, updates all of them.
 */
const query = graphql`
  query refreshAnnotationConfigsQuery {
    ...AnnotationConfigTableFragment
    annotationConfigs {
      edges {
        node {
          __typename
          ... on Node {
            id
          }
          ... on AnnotationConfigBase {
            name
            description
            annotationType
          }
          ... on CategoricalAnnotationConfig {
            optimizationDirection
            values {
              label
              score
            }
          }
          ... on ContinuousAnnotationConfig {
            optimizationDirection
            lowerBound
            upperBound
          }
          ... on FreeformAnnotationConfig {
            optimizationDirection
            threshold
          }
        }
      }
    }
  }
`;

export async function refreshAnnotationConfigs(): Promise<void> {
  try {
    await fetchQuery<refreshAnnotationConfigsQuery>(
      RelayEnvironment,
      query,
      {},
      { fetchPolicy: "network-only" }
    ).toPromise();
  } catch {
    // The write already succeeded; a failed refresh only leaves the list
    // stale until the page's own refetch.
  }
}
