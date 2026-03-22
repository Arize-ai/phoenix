import { graphql } from "relay-runtime";

import { PHOENIX_ROOT } from "@phoenix/agent/tools/bash/context/filesystem/pathConstants";

import type { GeneratedContextFile } from "../types";
import { createGraphqlContextFile, createJsonContextFile } from "./shared";

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
    createGraphqlContextFile({
      path: `${PHOENIX_ROOT}/graphql/examples/prompt-by-id.graphql`,
      request: promptByIdQuery,
      requestName: "promptPageContextByIdQuery",
    }),
    createJsonContextFile({
      path: `${PHOENIX_ROOT}/graphql/examples/prompt-by-id.variables.json`,
      value: { id: promptId },
    }),
  ];
}

export function buildPromptRecipeFiles(
  promptId?: string
): GeneratedContextFile[] {
  if (!promptId) {
    return [];
  }

  return [
    createGraphqlContextFile({
      path: `${PHOENIX_ROOT}/graphql/recipes/prompt-details.graphql`,
      request: promptByIdQuery,
      requestName: "promptPageContextByIdQuery",
    }),
    createJsonContextFile({
      path: `${PHOENIX_ROOT}/graphql/recipes/prompt-details.variables.json`,
      value: { id: promptId },
    }),
  ];
}
