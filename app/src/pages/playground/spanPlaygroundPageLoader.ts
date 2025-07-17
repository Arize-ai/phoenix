import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import {
  spanPlaygroundPageLoaderQuery,
  spanPlaygroundPageLoaderQuery$data,
} from "./__generated__/spanPlaygroundPageLoaderQuery.graphql";

/**
 * The type of a span that is fetched to pre-populate the playground.
 * This span gets fetched when navigating from a span to the playground, used for span replay.
 */
export type PlaygroundSpan = Extract<
  spanPlaygroundPageLoaderQuery$data["span"],
  { __typename: "Span" }
>;

export async function spanPlaygroundPageLoader(args: LoaderFunctionArgs) {
  const { spanId } = args.params;
  if (!spanId || typeof spanId !== "string") {
    throw new Error("Invalid spanId");
  }
  const loaderData = await fetchQuery<spanPlaygroundPageLoaderQuery>(
    RelayEnvironment,
    graphql`
      query spanPlaygroundPageLoaderQuery($spanId: ID!) {
        span: node(id: $spanId) {
          __typename
          ... on Span {
            id
            project {
              id
              name
            }
            spanId
            trace {
              id
              traceId
            }
            attributes
            invocationParameters {
              __typename
              ... on InvocationParameterBase {
                invocationName
                canonicalName
              }
              ... on BooleanInvocationParameter {
                invocationInputField
              }
              ... on StringInvocationParameter {
                invocationInputField
              }
              ... on BoundedFloatInvocationParameter {
                invocationInputField
              }
              ... on FloatInvocationParameter {
                invocationInputField
              }
              ... on IntInvocationParameter {
                invocationInputField
              }
              ... on JSONInvocationParameter {
                invocationInputField
              }
              ... on StringListInvocationParameter {
                invocationInputField
              }
            }
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
