import { graphql } from "relay-runtime";

import { PHOENIX_ROOT } from "@phoenix/agent/context/filesystem";

import type { GeneratedContextFile } from "../types";
import { formatJsonBlock, getGraphqlRequestText } from "./shared";

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
    {
      path: `${PHOENIX_ROOT}/graphql/examples/dataset-by-id.graphql`,
      content: getGraphqlRequestText(
        datasetByIdQuery,
        "datasetPageContextByIdQuery"
      ),
    },
    {
      path: `${PHOENIX_ROOT}/graphql/examples/dataset-by-id.variables.json`,
      content: `${formatJsonBlock({ id: datasetId })}
`,
    },
    {
      path: `${PHOENIX_ROOT}/graphql/examples/dataset-experiments.graphql`,
      content: getGraphqlRequestText(
        datasetExperimentsQuery,
        "datasetPageContextExperimentsQuery"
      ),
    },
  ];
}

export function buildDatasetRecipeFiles(
  datasetId?: string
): GeneratedContextFile[] {
  if (!datasetId) {
    return [];
  }

  return [
    {
      path: `${PHOENIX_ROOT}/graphql/recipes/dataset-experiments.graphql`,
      content: getGraphqlRequestText(
        datasetExperimentsQuery,
        "datasetPageContextExperimentsQuery"
      ),
    },
    {
      path: `${PHOENIX_ROOT}/graphql/recipes/dataset-experiments.variables.json`,
      content: `${formatJsonBlock({ id: datasetId })}
`,
    },
  ];
}
