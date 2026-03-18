import { graphql, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { promptConfigLoaderQuery } from "./__generated__/promptConfigLoaderQuery.graphql";

export const promptConfigLoaderQueryNode = graphql`
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

  const queryRef = loadQuery<promptConfigLoaderQuery>(
    RelayEnvironment,
    promptConfigLoaderQueryNode,
    { id: promptId }
  );

  return { queryRef };
};
