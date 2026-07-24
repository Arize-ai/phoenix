import { fetchQuery, graphql } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { sessionLoaderQuery } from "./__generated__/sessionLoaderQuery.graphql";

/**
 * Loads in the necessary page data for the dataset page
 */
export async function sessionLoader(args: LoaderFunctionArgs) {
  const { sessionId } = args.params;
  invariant(sessionId, "sessionId is required by the route definition");
  return await fetchQuery<sessionLoaderQuery>(
    RelayEnvironment,
    graphql`
      query sessionLoaderQuery($id: ID!) {
        session: node(id: $id) {
          id
          ... on ProjectSession {
            sessionId
          }
        }
      }
    `,
    {
      id: sessionId,
    }
  ).toPromise();
}
