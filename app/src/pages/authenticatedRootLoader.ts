import { fetchQuery, graphql } from "react-relay";
import { redirect } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

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
          passwordNeedsReset
        }
      }
    `,
    {}
  ).toPromise();

  if (!loaderData?.viewer && window.Config.authenticationEnabled) {
    // Should never happen but just in case
    return redirect("/login");
  }
  if (loaderData?.viewer?.passwordNeedsReset) {
    return redirect("/reset-password");
  }
  return loaderData;
}
