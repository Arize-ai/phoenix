import { fetchQuery, graphql } from "react-relay";
import { redirect } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";
import { createRedirectUrlWithReturn } from "@phoenix/utils/routingUtils";

import { authenticatedRootLoaderQuery } from "./__generated__/authenticatedRootLoaderQuery.graphql";

/**
 * Loads in the necessary data at the root of the authenticated application
 */
export async function authenticatedRootLoader() {
  const loaderData = await fetchQuery<authenticatedRootLoaderQuery>(
    RelayEnvironment,
    graphql`
      query authenticatedRootLoaderQuery {
        ...ViewerContext_viewer
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

  if (loaderData?.viewer?.passwordNeedsReset) {
    const redirectUrl = createRedirectUrlWithReturn({
      path: "/reset-password",
    });
    return redirect(redirectUrl);
  }

  return loaderData;
}
