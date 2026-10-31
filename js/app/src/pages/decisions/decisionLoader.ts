import { fetchQuery, graphql } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";

import {
  isServerUnreachableError,
  notFound,
} from "@phoenix/pages/redirects/notFound";
import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { decisionLoaderQuery } from "./__generated__/decisionLoaderQuery.graphql";

/** Resolve breadcrumb identity; the mounted page owns its rendered Relay query. */
export async function decisionLoader({ params }: LoaderFunctionArgs) {
  const { decisionId } = params;
  if (!decisionId)
    throw new Response("Decision ID is required", { status: 400 });
  const notFoundError = notFound({
    kind: "entity",
    entityType: "decision",
    identifier: decisionId,
  });
  // The server rejects an id that names no decision, deleted or malformed.
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
    { id: decisionId }
  )
    .toPromise()
    .catch((error: unknown) => {
      throw isServerUnreachableError(error) ? error : notFoundError;
    });
  if (result?.decision?.__typename !== "Decision") throw notFoundError;
  return { decision: result.decision };
}
export type DecisionLoaderData = Awaited<ReturnType<typeof decisionLoader>>;
