import { graphql, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { sessionLoaderQuery } from "./__generated__/sessionLoaderQuery.graphql";

export const sessionLoaderQueryNode = graphql`
  query sessionLoaderQuery($id: ID!) {
    session: node(id: $id) {
      id
      ... on ProjectSession {
        sessionId
      }
    }
  }
`;

/** Loads the session identifier shown in the session drawer title. */
export function sessionLoader({ params }: LoaderFunctionArgs) {
  const { sessionId } = params;
  invariant(sessionId, "sessionId is required");

  const queryRef = loadQuery<sessionLoaderQuery>(
    RelayEnvironment,
    sessionLoaderQueryNode,
    { id: sessionId },
    { fetchPolicy: "store-or-network" }
  );

  return { queryRef };
}

export type SessionLoaderData = ReturnType<typeof sessionLoader>;
