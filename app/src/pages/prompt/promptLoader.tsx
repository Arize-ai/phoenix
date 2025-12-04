import { fetchQuery, graphql, loadQuery } from "react-relay";
import { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { promptLoaderQuery as promptLoaderQueryType } from "./__generated__/promptLoaderQuery.graphql";

/**
 * Loads in the necessary page data for the prompt/:promptId pages
 *
 * Child routes of prompt/:promptId will have access to this loader's data
 * via usePromptIdLoader. They can add fragments to this loader's query to
 * load additional data.
 */
export async function promptLoader(args: LoaderFunctionArgs) {
  const { promptId } = args.params;
  invariant(promptId, "promptId is required");

  const queryRef = loadQuery<promptLoaderQueryType>(
    RelayEnvironment,
    promptLoaderQuery,
    {
      id: promptId as string,
    }
  );
  const data = await fetchQuery<promptLoaderQueryType>(
    RelayEnvironment,
    graphql`
      query promptLoader_PromptQuery($id: ID!) {
        prompt: node(id: $id) {
          __typename
          id
          ... on Prompt {
            name
          }
        }
      }
    `,
    {
      id: promptId as string,
    }
  ).toPromise();

  return {
    queryRef,
    prompt: data?.prompt,
  };
}

/**
 * the loadQuery graphql query to be used for render as you fetch.
 */
export const promptLoaderQuery = graphql`
  query promptLoaderQuery($id: ID!) {
    prompt: node(id: $id) {
      __typename
      id
      ... on Prompt {
        name
        ...PromptIndexPage__main
        ...PromptVersionsPageContent__main
        ...PromptLayout__main
      }
    }
  }
`;

export type PromptLoaderData = Awaited<ReturnType<typeof promptLoader>>;
