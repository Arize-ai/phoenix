import { graphql } from "relay-runtime";

import { PHOENIX_ROOT } from "@phoenix/agent/tools/bash/context/filesystem/pathConstants";

import type { GeneratedContextFile } from "../types";
import { createGraphqlContextFile, createJsonContextFile } from "./shared";

const traceFromProjectQuery = graphql`
  query tracePageContextFromProjectQuery($projectId: ID!, $traceId: ID!) {
    node(id: $projectId) {
      __typename
      ... on Project {
        id
        name
        trace(traceId: $traceId) {
          id
          traceId
          latencyMs
        }
      }
    }
  }
`;

const traceDetailsQuery = graphql`
  query tracePageContextDetailsQuery($projectId: ID!, $traceId: ID!) {
    node(id: $projectId) {
      __typename
      ... on Project {
        id
        name
        trace(traceId: $traceId) {
          id
          traceId
          latencyMs
          projectSessionId
          spans(first: 20) {
            edges {
              node {
                id
                spanId
                name
                spanKind
                startTime
                endTime
                statusCode
              }
            }
          }
        }
      }
    }
  }
`;

export function buildTraceStarterFiles(
  projectId: string,
  traceId: string
): GeneratedContextFile[] {
  return [
    createGraphqlContextFile({
      path: `${PHOENIX_ROOT}/graphql/examples/trace-from-project.graphql`,
      request: traceFromProjectQuery,
      requestName: "tracePageContextFromProjectQuery",
    }),
    createJsonContextFile({
      path: `${PHOENIX_ROOT}/graphql/examples/trace-from-project.variables.json`,
      value: { projectId, traceId },
    }),
  ];
}

export function buildTraceRecipeFiles({
  projectId,
  traceId,
}: {
  projectId?: string;
  traceId?: string;
}): GeneratedContextFile[] {
  if (!projectId || !traceId) {
    return [];
  }

  return [
    createGraphqlContextFile({
      path: `${PHOENIX_ROOT}/graphql/recipes/trace-details.graphql`,
      request: traceDetailsQuery,
      requestName: "tracePageContextDetailsQuery",
    }),
    createJsonContextFile({
      path: `${PHOENIX_ROOT}/graphql/recipes/trace-details.variables.json`,
      value: { projectId, traceId },
    }),
  ];
}
