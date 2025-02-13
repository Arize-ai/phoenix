import { fetchQuery, graphql } from "react-relay";
import { redirect } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { resetPasswordLoaderQuery } from "./__generated__/resetPasswordLoaderQuery.graphql";

/**
 * Makes sure the user is logged in
 */
export async function resetPasswordLoader() {
  const loaderData = await fetchQuery<resetPasswordLoaderQuery>(
    RelayEnvironment,
    graphql`
      query resetPasswordLoaderQuery {
        viewer {
          id
          email
        }
        ...ResetPasswordFormQuery
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
