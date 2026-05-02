import { fetchQuery, graphql, loadQuery } from "react-relay";
import { redirect } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";
import { createRedirectUrlWithReturn } from "@phoenix/utils/routingUtils";

import type { authenticatedRootLoaderQuery } from "./__generated__/authenticatedRootLoaderQuery.graphql";

export const authenticatedRootLoaderQueryNode = graphql`
  query authenticatedRootLoaderQuery {
    ...ViewerContext_viewer
    agentsConfig {
      collectorEndpoint
      assistantProjectName
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
export async function authenticatedRootLoader() {
  const loaderData = await fetchQuery<authenticatedRootLoaderQuery>(
    RelayEnvironment,
    authenticatedRootLoaderQueryNode,
    {}
  ).toPromise();

  if (loaderData?.viewer?.passwordNeedsReset) {
    const redirectUrl = createRedirectUrlWithReturn({
      path: "/reset-password",
    });
    return redirect(redirectUrl);
  }

  const queryRef = loadQuery<authenticatedRootLoaderQuery>(
    RelayEnvironment,
    authenticatedRootLoaderQueryNode,
    {},
    {
      fetchPolicy: "store-or-network",
    }
  );

  return { queryRef };
}

export type AuthenticatedRootLoaderData = {
  queryRef: ReturnType<typeof loadQuery<authenticatedRootLoaderQuery>>;
};
