import { graphql, loadQuery } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

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

  return { queryRef };
}

export type ResetPasswordLoaderData = {
  queryRef: ReturnType<typeof loadQuery<ResetPasswordLoaderQuery>>;
};
