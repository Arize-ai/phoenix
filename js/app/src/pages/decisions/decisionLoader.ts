import { fetchQuery, graphql } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { decisionLoaderQuery } from "./__generated__/decisionLoaderQuery.graphql";

/** Resolve breadcrumb identity; the mounted page owns its rendered Relay query. */
export async function decisionLoader({ params }: LoaderFunctionArgs) {
  if (!params.decisionId)
    throw new Response("Decision ID is required", { status: 400 });
  const result = await fetchQuery<decisionLoaderQuery>(
    RelayEnvironment,
    graphql`
      query decisionLoaderQuery($id: ID!) {
        decision: node(id: $id) {
          __typename
          ... on Decision {
            id
            name
          }
        }
      }
    `,
    { id: params.decisionId }
  ).toPromise();
  return { decision: result?.decision };
}
export type DecisionLoaderData = Awaited<ReturnType<typeof decisionLoader>>;
