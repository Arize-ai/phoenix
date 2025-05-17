import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { promptLoaderQuery } from "./__generated__/promptLoaderQuery.graphql";

/**
 * Loads in the necessary page data for the prompt/:promptId pages
 *
 * Child routes of prompt/:promptId will have access to this loader's data
 * via usePromptIdLoader. They can add fragments to this loader's query to
 * load additional data.
 */
export async function promptLoader(args: LoaderFunctionArgs) {
  const { promptId } = args.params;
  // @TODO: fragments fetch _all_ prompt versions, without pagination.
  // We should probably figure out how to paginate across fragments because
  // some of them only need the latest prompt version, some need first 5, some need all, etc.
  return await fetchQuery<promptLoaderQuery>(
    RelayEnvironment,
    graphql`
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
    `,
    {
      id: promptId as string,
    }
  )
    .toPromise()
    .catch(() => {
      throw new Error("Prompt not found");
    });
}
