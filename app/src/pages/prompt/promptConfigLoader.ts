import { graphql, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { promptConfigLoaderQuery as PromptConfigLoaderQuery } from "./__generated__/promptConfigLoaderQuery.graphql";

export const promptConfigLoaderQuery = graphql`
  query promptConfigLoaderQuery($id: ID!) {
    prompt: node(id: $id) {
      ... on Prompt {
        ...PromptVersionTagsConfigCard_data
      }
    }
  }
`;

export const promptConfigLoader = ({ params }: LoaderFunctionArgs) => {
  const promptId = params.promptId;
  if (!promptId) {
    throw new Error("Prompt ID is required");
  }

  const queryRef = loadQuery<PromptConfigLoaderQuery>(
    RelayEnvironment,
    promptConfigLoaderQuery,
    { id: promptId }
  );

  return { queryRef };
};

export type PromptConfigLoaderData = ReturnType<typeof promptConfigLoader>;
