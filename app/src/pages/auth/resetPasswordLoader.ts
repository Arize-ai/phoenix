import { fetchQuery, graphql, loadQuery } from "react-relay";
import { redirect } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { resetPasswordLoaderCheckQuery as ResetPasswordLoaderCheckQuery } from "./__generated__/resetPasswordLoaderCheckQuery.graphql";
import type { resetPasswordLoaderQuery as ResetPasswordLoaderQuery } from "./__generated__/resetPasswordLoaderQuery.graphql";

/**
 * Query for the reset password loader.
 */
export const resetPasswordLoaderQuery = graphql`
  query resetPasswordLoaderQuery {
    ...ResetPasswordFormQuery
  }
`;

/**
 * Makes sure the user is logged in
 */
export async function resetPasswordLoader() {
  const queryRef = loadQuery<ResetPasswordLoaderQuery>(
    RelayEnvironment,
    resetPasswordLoaderQuery,
    {}
  );

  const data = await fetchQuery<ResetPasswordLoaderCheckQuery>(
    RelayEnvironment,
    graphql`
      query resetPasswordLoaderCheckQuery {
        viewer {
          id
        }
      }
    `,
    {}
  ).toPromise();

  if (!data?.viewer) {
    // Should never happen but just in case
    return redirect("/login");
  }

  return { queryRef };
}

export type ResetPasswordLoaderData = {
  queryRef: ReturnType<typeof loadQuery<ResetPasswordLoaderQuery>>;
};
