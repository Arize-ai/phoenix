import { graphql } from "relay-runtime";

import { PHOENIX_ROOT } from "@phoenix/agent/tools/bash/context/filesystem/pathConstants";
import type { AgentPageContext } from "@phoenix/agent/tools/bash/context/pageContextTypes";

import type { GeneratedContextFile } from "../types";
import { createGraphqlContextFile, createJsonContextFile } from "./shared";

const projectByIdQuery = graphql`
  query projectPageContextProjectByIdQuery($id: ID!) {
    node(id: $id) {
      __typename
      ... on Project {
        id
        name
        traceCount
        recordCount
      }
    }
  }
`;

const projectRecentTracesQuery = graphql`
  query projectPageContextRecentTracesQuery($id: ID!, $timeRange: TimeRange) {
    node(id: $id) {
      __typename
      ... on Project {
        id
        name
        spans(
          first: 5
          rootSpansOnly: true
          sort: { col: startTime, dir: desc }
          timeRange: $timeRange
        ) {
          edges {
            node {
              id
              spanId
              name
              startTime
              endTime
              latencyMs
              statusCode
              trace {
                id
                traceId
              }
            }
          }
        }
      }
    }
  }
`;

const projectRecentSpansQuery = graphql`
  query projectPageContextRecentSpansQuery($id: ID!, $timeRange: TimeRange) {
    node(id: $id) {
      __typename
      ... on Project {
        id
        name
        spans(
          first: 10
          sort: { col: startTime, dir: desc }
          timeRange: $timeRange
        ) {
          edges {
            node {
              id
              spanId
              name
              spanKind
              startTime
              latencyMs
              statusCode
              trace {
                id
                traceId
              }
            }
          }
        }
      }
    }
  }
`;

const projectRecentSessionsQuery = graphql`
  query projectPageContextRecentSessionsQuery($id: ID!, $timeRange: TimeRange) {
    node(id: $id) {
      __typename
      ... on Project {
        id
        name
        sessions(
          first: 5
          sort: { col: startTime, dir: desc }
          timeRange: $timeRange
        ) {
          edges {
            node {
              id
              sessionId
              startTime
              endTime
              numTraces
            }
          }
        }
      }
    }
  }
`;

export function buildProjectStarterFiles(
  projectId: string
): GeneratedContextFile[] {
  return [
    createGraphqlContextFile({
      path: `${PHOENIX_ROOT}/graphql/examples/project-by-id.graphql`,
      request: projectByIdQuery,
      requestName: "projectPageContextProjectByIdQuery",
    }),
    createJsonContextFile({
      path: `${PHOENIX_ROOT}/graphql/examples/project-by-id.variables.json`,
      value: { id: projectId },
    }),
  ];
}

export function buildProjectRecipeFiles(
  pageContext: AgentPageContext
): GeneratedContextFile[] {
  const projectId = pageContext.params.projectId;

  if (!projectId) {
    return [];
  }

  const sharedVariables = {
    id: projectId,
  };

  return [
    createGraphqlContextFile({
      path: `${PHOENIX_ROOT}/graphql/recipes/project-recent-traces.graphql`,
      request: projectRecentTracesQuery,
      requestName: "projectPageContextRecentTracesQuery",
    }),
    createGraphqlContextFile({
      path: `${PHOENIX_ROOT}/graphql/recipes/project-recent-spans.graphql`,
      request: projectRecentSpansQuery,
      requestName: "projectPageContextRecentSpansQuery",
    }),
    createGraphqlContextFile({
      path: `${PHOENIX_ROOT}/graphql/recipes/project-recent-sessions.graphql`,
      request: projectRecentSessionsQuery,
      requestName: "projectPageContextRecentSessionsQuery",
    }),
    createJsonContextFile({
      path: `${PHOENIX_ROOT}/graphql/recipes/project-recipes.variables.json`,
      value: sharedVariables,
    }),
  ];
}
