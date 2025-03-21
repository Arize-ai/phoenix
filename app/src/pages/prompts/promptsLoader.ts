import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { promptsLoaderQuery } from "./__generated__/promptsLoaderQuery.graphql";

/**
 * Loads in the necessary page data for the dataset page
 */
export async function promptsLoader(_args: LoaderFunctionArgs) {
  return await fetchQuery<promptsLoaderQuery>(
    RelayEnvironment,
    graphql`
      query promptsLoaderQuery {
        ...PromptsTable_prompts
      }
    `,
    {}
  ).toPromise();
}
