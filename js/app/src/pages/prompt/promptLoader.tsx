import { fetchQuery, graphql, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";

import {
  isServerUnreachableError,
  notFound,
} from "@phoenix/pages/redirects/notFound";
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
  const notFoundError = notFound({
    kind: "entity",
    entityType: "prompt",
    identifier: promptId,
  });

  const queryRef = loadQuery<promptLoaderQueryType>(
    RelayEnvironment,
    promptLoaderQuery,
    {
      id: promptId as string,
    },
    {
      fetchPolicy: "store-and-network",
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
  )
    .toPromise()
    // The server rejects an id that names no prompt, deleted or malformed.
    .catch((error: unknown) => {
      queryRef.dispose();
      throw isServerUnreachableError(error) ? error : notFoundError;
    });
  if (data?.prompt?.__typename !== "Prompt") {
    queryRef.dispose();
    throw notFoundError;
  }

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
