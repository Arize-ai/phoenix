import { graphql, loadQuery } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { authenticatedRootLoaderQuery } from "./__generated__/authenticatedRootLoaderQuery.graphql";

export const authenticatedRootLoaderQueryNode = graphql`
  query authenticatedRootLoaderQuery {
    ...ViewerContext_viewer
    agentsConfig {
      collectorEndpoint
      assistantProjectName
      forceTracing
      webAccessEnabled
      assistantEnabled
      githubServerEnabled
      githubEnabled
      githubWorkspaceTokenConfigured
      allowLocalTraces
      allowRemoteExport
      sessionRetentionMaxIdleDays
      sessionRetentionMaxCountPerUser
    }
    viewer {
      id
      username
      email
      passwordNeedsReset
    }
  }
`;

/**
 * Loads in the necessary data at the root of the authenticated application
 */
export function authenticatedRootLoader() {
  const queryRef = loadQuery<authenticatedRootLoaderQuery>(
    RelayEnvironment,
    authenticatedRootLoaderQueryNode,
    {},
    {
      fetchPolicy: "store-and-network",
    }
  );

  return { queryRef };
}

export type AuthenticatedRootLoaderData = {
  queryRef: ReturnType<typeof loadQuery<authenticatedRootLoaderQuery>>;
};
