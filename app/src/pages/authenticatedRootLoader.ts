import { fetchQuery, graphql, loadQuery } from "react-relay";
import { redirect } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";
import { createRedirectUrlWithReturn } from "@phoenix/utils/routingUtils";

import type { authenticatedRootLoader_viewerPasswordNeedsResetQuery as AuthenticatedRootLoader_viewerPasswordNeedsResetQuery } from "./__generated__/authenticatedRootLoader_viewerPasswordNeedsResetQuery.graphql";
import type { authenticatedRootLoaderQuery as AuthenticatedRootLoaderQueryType } from "./__generated__/authenticatedRootLoaderQuery.graphql";

/**
 * Query for the authenticated root loader.
 */
export const authenticatedRootLoaderQuery = graphql`
  query authenticatedRootLoaderQuery {
    ...AuthenticatedRoot_viewer
    ...ViewerContext_viewer
  }
`;

/**
 * Loads in the necessary data at the root of the authenticated application
 */
export async function authenticatedRootLoader() {
  // Use loadQuery so Relay ties the query's lifetime to the mounted component,
  // preventing GC from evicting the cache while the component is still rendered.
  const queryRef = loadQuery<AuthenticatedRootLoaderQueryType>(
    RelayEnvironment,
    authenticatedRootLoaderQuery,
    {}
  );
  const data =
    await fetchQuery<AuthenticatedRootLoader_viewerPasswordNeedsResetQuery>(
      RelayEnvironment,
      graphql`
        query authenticatedRootLoader_viewerPasswordNeedsResetQuery {
          viewer {
            passwordNeedsReset
          }
        }
      `,
      {}
    ).toPromise();

  if (data?.viewer?.passwordNeedsReset) {
    const redirectUrl = createRedirectUrlWithReturn({
      path: "/reset-password",
    });
    return redirect(redirectUrl);
  }

  return {
    queryRef,
  };
}

export type AuthenticatedRootLoaderData = {
  queryRef: ReturnType<typeof loadQuery<AuthenticatedRootLoaderQueryType>>;
};
