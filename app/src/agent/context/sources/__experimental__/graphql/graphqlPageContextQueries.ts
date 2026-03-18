export const PROJECT_SUMMARY_QUERY = `
  query AgentProjectSummaryContextQuery($id: ID!, $timeRange: TimeRange) {
    project: node(id: $id) {
      __typename
      ... on Project {
        id
        name
        traceCount(timeRange: $timeRange)
        spanCount: recordCount
      }
    }
  }
`;

export const PROJECT_TRACES_QUERY = `
  query AgentProjectTracesContextQuery($id: ID!, $timeRange: TimeRange!) {
    project: node(id: $id) {
      __typename
      ... on Project {
        rootSpans: spans(first: 30, sort: { col: startTime, dir: desc }, rootSpansOnly: true, timeRange: $timeRange) {
          edges {
            node {
              id
              spanId
              name
              spanKind
              statusCode
              startTime
              endTime
              latencyMs
              cumulativeTokenCountTotal
              input {
                value: truncatedValue
              }
              output {
                value: truncatedValue
              }
              trace {
                id
                traceId
                numSpans
                costSummary {
                  total {
                    cost
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const PROJECT_SPANS_QUERY = `
  query AgentProjectSpansContextQuery($id: ID!, $timeRange: TimeRange!) {
    project: node(id: $id) {
      __typename
      ... on Project {
        spans(first: 30, sort: { col: startTime, dir: desc }, rootSpansOnly: true, orphanSpanAsRootSpan: true, timeRange: $timeRange) {
          edges {
            node {
              id
              spanId
              name
              spanKind
              statusCode
              startTime
              latencyMs
              tokenCountTotal
              cumulativeTokenCountTotal
              input {
                value: truncatedValue
              }
              output {
                value: truncatedValue
              }
              trace {
                id
                traceId
                costSummary {
                  total {
                    cost
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const PROJECT_SESSIONS_QUERY = `
  query AgentProjectSessionsContextQuery($id: ID!, $timeRange: TimeRange!) {
    project: node(id: $id) {
      __typename
      ... on Project {
        sessions(first: 30, sort: { col: startTime, dir: desc }, timeRange: $timeRange) {
          edges {
            node {
              id
              sessionId
              numTraces
              startTime
              endTime
              firstInput {
                value
              }
              lastOutput {
                value
              }
              tokenUsage {
                total
              }
              traceLatencyMsP50: traceLatencyMsQuantile(probability: 0.5)
              traceLatencyMsP99: traceLatencyMsQuantile(probability: 0.99)
              costSummary {
                total {
                  cost
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const TRACE_CONTEXT_QUERY = `
  query AgentTraceContextQuery($id: ID!, $traceId: ID!) {
    project: node(id: $id) {
      __typename
      ... on Project {
        id
        name
        trace(traceId: $traceId) {
          id
          projectSessionId
          latencyMs
          costSummary {
            prompt {
              cost
            }
            completion {
              cost
            }
            total {
              cost
            }
          }
          rootSpans: spans(first: 1, rootSpansOnly: true, orphanSpanAsRootSpan: true) {
            edges {
              node {
                id
                spanId
                parentId
                statusCode
              }
            }
          }
          spans(first: 1000) {
            edges {
              node {
                id
                spanId
                name
                spanKind
                statusCode
                startTime
                endTime
                parentId
                latencyMs
                tokenCountTotal
              }
            }
          }
        }
      }
    }
  }
`;
