import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { authenticatedRootLoaderQuery } from "./__generated__/authenticatedRootLoaderQuery.graphql";

/**
 * Loads in the necessary data at the root of the authenticated application
 */
export async function authenticatedRootLoader() {
  return await fetchQuery<authenticatedRootLoaderQuery>(
    RelayEnvironment,
    graphql`
      query authenticatedRootLoaderQuery {
        ...ViewerContext_viewer
      }
    `,
    {}
  ).toPromise();
}
