import { graphql, loadQuery } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type {
  promptsLoaderQuery,
  promptsLoaderQuery$variables,
} from "./__generated__/promptsLoaderQuery.graphql";

export const promptsLoaderGql = graphql`
  query promptsLoaderQuery {
    ...PromptsTable_prompts
  }
`;

/**
 * Loads in the necessary page data for the prompts page
 */
export function promptsLoader() {
  return loadQuery<promptsLoaderQuery, promptsLoaderQuery$variables>(
    RelayEnvironment,
    promptsLoaderGql,
    {},
    { fetchPolicy: "store-and-network" }
  );
}

export type PromptsLoaderType = ReturnType<typeof promptsLoader>;
