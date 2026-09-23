import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { refreshDatasetSplitsQuery } from "./__generated__/refreshDatasetSplitsQuery.graphql";

/**
 * Re-read the root `datasetSplits` list over the network after a split is
 * created or deleted.
 *
 * A `query { datasetSplits { ... } }` selection inside a mutation payload does
 * not do this: Relay normalizes it under the mutation's own client record
 * (`client:local:N:createDatasetSplit(...):query`), not `client:root`, so the
 * lists the examples page's Splits filter and assign-to-split menu read from
 * the root stay stale until their own `store-and-network` refetch. Fetching
 * the root field directly updates every subscriber at once.
 */
const query = graphql`
  query refreshDatasetSplitsQuery {
    datasetSplits {
      edges {
        node {
          id
          name
          description
          color
        }
      }
    }
  }
`;

export async function refreshDatasetSplits(): Promise<void> {
  try {
    await fetchQuery<refreshDatasetSplitsQuery>(
      RelayEnvironment,
      query,
      {},
      { fetchPolicy: "network-only" }
    ).toPromise();
  } catch {
    // The write already succeeded; a failed refresh only leaves the menus to
    // refetch on their next open.
  }
}
