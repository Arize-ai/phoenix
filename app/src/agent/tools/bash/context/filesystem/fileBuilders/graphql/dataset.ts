import { graphql } from "relay-runtime";

import { PHOENIX_ROOT } from "@phoenix/agent/tools/bash/context/filesystem/pathConstants";

import type { GeneratedContextFile } from "../types";
import { createGraphqlContextFile, createJsonContextFile } from "./shared";

const datasetByIdQuery = graphql`
  query datasetPageContextByIdQuery($id: ID!) {
    node(id: $id) {
      __typename
      ... on Dataset {
        id
        name
        description
      }
    }
  }
`;

const datasetExperimentsQuery = graphql`
  query datasetPageContextExperimentsQuery($id: ID!) {
    node(id: $id) {
      __typename
      ... on Dataset {
        id
        name
        experiments(first: 10) {
          edges {
            node {
              id
            }
          }
        }
      }
    }
  }
`;

export function buildDatasetStarterFiles(
  datasetId: string
): GeneratedContextFile[] {
  return [
    createGraphqlContextFile({
      path: `${PHOENIX_ROOT}/graphql/examples/dataset-by-id.graphql`,
      request: datasetByIdQuery,
      requestName: "datasetPageContextByIdQuery",
    }),
    createJsonContextFile({
      path: `${PHOENIX_ROOT}/graphql/examples/dataset-by-id.variables.json`,
      value: { id: datasetId },
    }),
    createGraphqlContextFile({
      path: `${PHOENIX_ROOT}/graphql/examples/dataset-experiments.graphql`,
      request: datasetExperimentsQuery,
      requestName: "datasetPageContextExperimentsQuery",
    }),
  ];
}

export function buildDatasetRecipeFiles(
  datasetId?: string
): GeneratedContextFile[] {
  if (!datasetId) {
    return [];
  }

  return [
    createGraphqlContextFile({
      path: `${PHOENIX_ROOT}/graphql/recipes/dataset-experiments.graphql`,
      request: datasetExperimentsQuery,
      requestName: "datasetPageContextExperimentsQuery",
    }),
    createJsonContextFile({
      path: `${PHOENIX_ROOT}/graphql/recipes/dataset-experiments.variables.json`,
      value: { id: datasetId },
    }),
  ];
}
