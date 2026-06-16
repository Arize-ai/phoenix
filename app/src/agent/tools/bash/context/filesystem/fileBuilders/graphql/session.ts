import { graphql } from "relay-runtime";

import { PHOENIX_ROOT } from "@phoenix/agent/tools/bash/context/filesystem/pathConstants";
import type { AgentPageContext } from "@phoenix/agent/tools/bash/context/pageContextTypes";
import { SELECTED_TRACE_ID_PARAM } from "@phoenix/constants/searchParams";

import type { GeneratedContextFile } from "../types";
import { createGraphqlContextFile, createJsonContextFile } from "./shared";

const sessionByIdQuery = graphql`
  query sessionPageContextByIdQuery($id: ID!) {
    node(id: $id) {
      __typename
      ... on ProjectSession {
        id
        sessionId
        startTime
        endTime
        numTraces
        tokenUsage {
          total
        }
        costSummary {
          total {
            cost
            tokens
          }
          prompt {
            cost
            tokens
          }
          completion {
            cost
            tokens
          }
        }
        latencyP50: traceLatencyMsQuantile(probability: 0.5)
      }
    }
  }
`;

const sessionTracesQuery = graphql`
  query sessionPageContextTracesQuery($id: ID!, $first: Int = 10) {
    node(id: $id) {
      __typename
      ... on ProjectSession {
        id
        sessionId
        numTraces
        traces(first: $first) {
          edges {
            trace: node {
              id
              traceId
              rootSpan {
                id
                spanId
                name
                spanKind
                startTime
                endTime
                latencyMs
                statusCode
                cumulativeTokenCountTotal
                input {
                  value
                  truncatedValue
                  mimeType
                }
                output {
                  value
                  truncatedValue
                  mimeType
                }
                trace {
                  id
                  costSummary {
                    total {
                      cost
                    }
                  }
                }
              }
            }
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }
  }
`;

const sessionSelectedTraceQuery = graphql`
  query sessionPageContextSelectedTraceQuery($projectId: ID!, $traceId: ID!) {
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
          rootSpan {
            id
            spanId
            name
            spanKind
            startTime
            endTime
            latencyMs
            statusCode
            cumulativeTokenCountTotal
            input {
              value
              truncatedValue
              mimeType
            }
            output {
              value
              truncatedValue
              mimeType
            }
          }
          spans(first: 20) {
            edges {
              node {
                id
                spanId
                parentId
                name
                spanKind
                startTime
                endTime
                latencyMs
                statusCode
              }
            }
          }
        }
      }
    }
  }
`;

function getSearchParam(
  pageContext: AgentPageContext,
  name: string
): string | undefined {
  const value = pageContext.searchParams[name];
  return typeof value === "string" ? value : undefined;
}

export function buildSessionStarterFiles(
  sessionId: string
): GeneratedContextFile[] {
  return [
    createGraphqlContextFile({
      path: `${PHOENIX_ROOT}/graphql/examples/session-by-id.graphql`,
      request: sessionByIdQuery,
      requestName: "sessionPageContextByIdQuery",
    }),
    createJsonContextFile({
      path: `${PHOENIX_ROOT}/graphql/examples/session-by-id.variables.json`,
      value: { id: sessionId },
    }),
  ];
}

export function buildSessionRecipeFiles(
  pageContext: AgentPageContext
): GeneratedContextFile[] {
  const { projectId, sessionId } = pageContext.params;
  const selectedTraceId = getSearchParam(pageContext, SELECTED_TRACE_ID_PARAM);

  if (!sessionId) {
    return [];
  }

  const files: GeneratedContextFile[] = [
    createGraphqlContextFile({
      path: `${PHOENIX_ROOT}/graphql/recipes/session-summary.graphql`,
      request: sessionByIdQuery,
      requestName: "sessionPageContextByIdQuery",
    }),
    createGraphqlContextFile({
      path: `${PHOENIX_ROOT}/graphql/recipes/session-traces.graphql`,
      request: sessionTracesQuery,
      requestName: "sessionPageContextTracesQuery",
    }),
    createJsonContextFile({
      path: `${PHOENIX_ROOT}/graphql/recipes/session-recipes.variables.json`,
      value: { id: sessionId, first: 10 },
    }),
  ];

  if (projectId && selectedTraceId) {
    files.push(
      createGraphqlContextFile({
        path: `${PHOENIX_ROOT}/graphql/recipes/session-selected-trace.graphql`,
        request: sessionSelectedTraceQuery,
        requestName: "sessionPageContextSelectedTraceQuery",
      }),
      createJsonContextFile({
        path: `${PHOENIX_ROOT}/graphql/recipes/session-selected-trace.variables.json`,
        value: { projectId, traceId: selectedTraceId },
      })
    );
  }

  return files;
}
