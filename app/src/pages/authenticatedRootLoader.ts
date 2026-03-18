import { fetchQuery, graphql, loadQuery } from "react-relay";
import { redirect } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";
import { createRedirectUrlWithReturn } from "@phoenix/utils/routingUtils";

import type { authenticatedRootLoader_viewerQuery } from "./__generated__/authenticatedRootLoader_viewerQuery.graphql";
import type { authenticatedRootLoaderQuery as AuthenticatedRootLoaderQueryType } from "./__generated__/authenticatedRootLoaderQuery.graphql";

/**
 * The loadQuery graphql query node for the authenticated root.
 * Exported so AuthenticatedRoot can reference it in usePreloadedQuery.
 */
export const authenticatedRootLoaderQuery = graphql`
  query authenticatedRootLoaderQuery {
    ...ViewerContext_viewer
  }
`;

/**
 * Loads in the necessary data at the root of the authenticated application
 */
export async function authenticatedRootLoader() {
  // Small separate fetch for the scalar needed to check the redirect condition
  // before the component mounts.
  const viewerData = await fetchQuery<authenticatedRootLoader_viewerQuery>(
    RelayEnvironment,
    graphql`
      query authenticatedRootLoader_viewerQuery {
        viewer {
          id
          username
          email
          passwordNeedsReset
        }
      }
    `,
    {}
  ).toPromise();

  if (viewerData?.viewer?.passwordNeedsReset) {
    const redirectUrl = createRedirectUrlWithReturn({
      path: "/reset-password",
    });
    return redirect(redirectUrl);
  }

  // Use loadQuery so Relay ties the query's lifetime to the mounted component,
  // preventing GC from evicting the cache while the component is still rendered.
  const queryRef = loadQuery<AuthenticatedRootLoaderQueryType>(
    RelayEnvironment,
    authenticatedRootLoaderQuery,
    {}
  );

  return {
    queryRef,
    viewer: viewerData?.viewer,
  };
}

export type AuthenticatedRootLoaderData = Awaited<
  ReturnType<typeof authenticatedRootLoader>
>;

/**
 * The non-redirect branch of the loader data — what the component receives
 * at render time (redirects are handled by React Router before mounting).
 */
export type AuthenticatedRootLoaderDataResolved = Extract<
  AuthenticatedRootLoaderData,
  { queryRef: unknown }
>;
