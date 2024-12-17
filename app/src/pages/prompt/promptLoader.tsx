import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router-dom";

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
  return await fetchQuery<promptLoaderQuery>(
    RelayEnvironment,
    graphql`
      query promptLoaderQuery($id: GlobalID!) {
        prompt: node(id: $id) {
          __typename
          id
          ... on Prompt {
            name
            ...PromptIndexPage__main
            ...PromptVersionsPageContent__main
          }
        }
      }
    `,
    {
      id: promptId as string,
    }
  )
    .toPromise()
    .catch(() => new Response("Prompt not found", { status: 404 }));
}
