import { graphql } from "relay-runtime";

import { PHOENIX_ROOT } from "@phoenix/agent/context/filesystem";

import type { GeneratedContextFile } from "../types";
import { formatJsonBlock, getGraphqlRequestText } from "./shared";

const promptByIdQuery = graphql`
  query promptPageContextByIdQuery($id: ID!) {
    node(id: $id) {
      __typename
      ... on Prompt {
        id
        name
      }
    }
  }
`;

export function buildPromptStarterFiles(
  promptId: string
): GeneratedContextFile[] {
  return [
    {
      path: `${PHOENIX_ROOT}/graphql/examples/prompt-by-id.graphql`,
      content: getGraphqlRequestText(
        promptByIdQuery,
        "promptPageContextByIdQuery"
      ),
    },
    {
      path: `${PHOENIX_ROOT}/graphql/examples/prompt-by-id.variables.json`,
      content: `${formatJsonBlock({ id: promptId })}
`,
    },
  ];
}

export function buildPromptRecipeFiles(
  promptId?: string
): GeneratedContextFile[] {
  if (!promptId) {
    return [];
  }

  return [
    {
      path: `${PHOENIX_ROOT}/graphql/recipes/prompt-details.graphql`,
      content: getGraphqlRequestText(
        promptByIdQuery,
        "promptPageContextByIdQuery"
      ),
    },
    {
      path: `${PHOENIX_ROOT}/graphql/recipes/prompt-details.variables.json`,
      content: `${formatJsonBlock({ id: promptId })}
`,
    },
  ];
}
