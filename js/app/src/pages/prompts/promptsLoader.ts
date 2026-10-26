import { graphql, loadQuery } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type {
  promptsLoaderQuery,
  promptsLoaderQuery$variables,
} from "./__generated__/promptsLoaderQuery.graphql";

export const promptsLoaderGql = graphql`
  query promptsLoaderQuery {
    ...PromptsTable_items
  }
`;

/**
 * Loads in the necessary page data for the prompts page, which lists prompts
 * and decisions together
 */
export function promptsLoader() {
  return loadQuery<promptsLoaderQuery, promptsLoaderQuery$variables>(
    RelayEnvironment,
    promptsLoaderGql,
    {}
  );
}

export type PromptsLoaderType = ReturnType<typeof promptsLoader>;
