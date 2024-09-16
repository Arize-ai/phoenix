import { fetchQuery, graphql } from "react-relay";
import { redirect } from "react-router";
import { LoaderFunctionArgs } from "react-router-dom";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { resetPasswordLoaderQuery } from "./__generated__/resetPasswordLoaderQuery.graphql";

/**
 * Makes sure the user is logged in
 */
export async function resetPasswordLoader(args: LoaderFunctionArgs) {
  const { token } = args.params;
  if (!token) {
    return null;
  }
  const loaderData = await fetchQuery<resetPasswordLoaderQuery>(
    RelayEnvironment,
    graphql`
      query resetPasswordLoaderQuery {
        viewer {
          id
          email
        }
      }
    `,
    {}
  ).toPromise();

  if (!loaderData?.viewer) {
    // Should never happen but just in case
    return redirect("/login");
  }

  return loaderData;
}
