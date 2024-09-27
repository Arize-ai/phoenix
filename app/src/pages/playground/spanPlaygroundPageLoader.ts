import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { spanPlaygroundPageLoaderQuery } from "./__generated__/spanPlaygroundPageLoaderQuery.graphql";
/**
 *
 */
export async function spanPlaygroundPageLoader(args: LoaderFunctionArgs) {
  const { spanId } = args.params;
  if (!spanId || typeof spanId !== "string") {
    throw new Error("Invalid spanId");
  }
  const loaderData = await fetchQuery<spanPlaygroundPageLoaderQuery>(
    RelayEnvironment,
    graphql`
      query spanPlaygroundPageLoaderQuery($spanId: GlobalID!) {
        span: node(id: $spanId) {
          __typename
          ... on Span {
            attributes
          }
        }
      }
    `,
    {
      spanId,
    }
  ).toPromise();
  return loaderData;
}
