import { fetchQuery, graphql, loadQuery } from "react-relay";
import { redirect } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { resetPasswordLoaderQuery as resetPasswordLoaderQueryType } from "./__generated__/resetPasswordLoaderQuery.graphql";

/**
 * The loadQuery graphql query node to be used for render-as-you-fetch.
 */
export const resetPasswordLoaderQuery = graphql`
  query resetPasswordLoaderQuery {
    viewer {
      id
      email
    }
    ...ResetPasswordFormQuery
  }
`;

/**
 * Makes sure the user is logged in
 */
export async function resetPasswordLoader() {
  const queryRef = loadQuery<resetPasswordLoaderQueryType>(
    RelayEnvironment,
    resetPasswordLoaderQuery,
    {}
  );

  // Fetch scalar fields needed for the redirect check
  const data = await fetchQuery<resetPasswordLoaderQueryType>(
    RelayEnvironment,
    resetPasswordLoaderQuery,
    {}
  ).toPromise();

  if (!data?.viewer) {
    // Should never happen but just in case
    return redirect("/login");
  }

  return { queryRef };
}

export type ResetPasswordLoaderData = {
  queryRef: ReturnType<typeof loadQuery<resetPasswordLoaderQueryType>>;
};
