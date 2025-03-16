import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { promptConfigLoaderQuery } from "./__generated__/promptConfigLoaderQuery.graphql";

export const promptConfigLoader = async ({ params }: LoaderFunctionArgs) => {
  const promptId = params.promptId;
  if (!promptId) {
    throw new Error("Prompt ID is required");
  }

  return await fetchQuery<promptConfigLoaderQuery>(
    RelayEnvironment,
    graphql`
      query promptConfigLoaderQuery($id: ID!) {
        prompt: node(id: $id) {
          ... on Prompt {
            ...PromptVersionTagsConfigCard_data
          }
        }
      }
    `,
    { id: promptId }
  ).toPromise();
};
