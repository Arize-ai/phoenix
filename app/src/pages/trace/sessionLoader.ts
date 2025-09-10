import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { sessionLoaderQuery } from "./__generated__/sessionLoaderQuery.graphql";

/**
 * Loads in the necessary page data for the dataset page
 */
export async function sessionLoader(args: LoaderFunctionArgs) {
  const { sessionId } = args.params;
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
      id: sessionId as string,
    }
  ).toPromise();
}
