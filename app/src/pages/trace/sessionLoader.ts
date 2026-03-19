import { graphql, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { sessionLoaderQuery as SessionLoaderQuery } from "./__generated__/sessionLoaderQuery.graphql";

export const sessionLoaderQuery = graphql`
  query sessionLoaderQuery($id: ID!) {
    session: node(id: $id) {
      id
      ... on ProjectSession {
        sessionId
      }
    }
  }
`;

/**
 * Loads in the necessary page data for the session page
 */
export function sessionLoader(args: LoaderFunctionArgs) {
  const { sessionId } = args.params;
  const queryRef = loadQuery<SessionLoaderQuery>(
    RelayEnvironment,
    sessionLoaderQuery,
    {
      id: sessionId as string,
    }
  );
  return { queryRef };
}

export type SessionLoaderData = ReturnType<typeof sessionLoader>;
