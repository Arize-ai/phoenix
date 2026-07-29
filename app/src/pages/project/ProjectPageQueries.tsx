import { createContext, useContext } from "react";
import type { PreloadedQuery } from "react-relay";
import { graphql } from "react-relay";

import type { ProjectPageQueriesProjectConfigQuery as ProjectPageProjectConfigQueryType } from "./__generated__/ProjectPageQueriesProjectConfigQuery.graphql";
import type { ProjectPageQueriesSessionsQuery as ProjectPageSessionsQueryType } from "./__generated__/ProjectPageQueriesSessionsQuery.graphql";
import type { ProjectPageQueriesSpansQuery as ProjectPageSpansQueryType } from "./__generated__/ProjectPageQueriesSpansQuery.graphql";
import type { ProjectPageQueriesTracesQuery as ProjectPageTracesQueryType } from "./__generated__/ProjectPageQueriesTracesQuery.graphql";
import type { SpanFilterSeed } from "./spanFilterSeed";
export const ProjectPageQueriesTracesQuery = graphql`
  query ProjectPageQueriesTracesQuery($id: ID!, $timeRange: TimeRange!) {
    project: node(id: $id) {
      ... on Project {
        name
        hasTraces
      }
      ...TracesTable_spans
    }
  }
`;

// The spans table starts from a filter condition -- the page default, or one
// restored from the URL -- so this query carries it rather than fetching every
// span and letting the table correct itself on mount. `rootSpansOnly` rides
// along because it selects between cumulative and per-span metric fields, and
// fetching the wrong set is what forces a second round-trip.
export const ProjectPageQueriesSpansQuery = graphql`
  query ProjectPageQueriesSpansQuery(
    $id: ID!
    $timeRange: TimeRange!
    $filterCondition: String
    $rootSpansOnly: Boolean!
  ) {
    project: node(id: $id) {
      ... on Project {
        name
        hasTraces
      }
      ...SpansTable_spans
        @arguments(
          filterCondition: $filterCondition
          rootSpansOnly: $rootSpansOnly
        )
    }
  }
`;

export const ProjectPageQueriesSessionsQuery = graphql`
  query ProjectPageQueriesSessionsQuery($id: ID!, $timeRange: TimeRange!) {
    project: node(id: $id) {
      ...SessionsTable_sessions
    }
  }
`;

export const ProjectPageQueriesProjectConfigQuery = graphql`
  query ProjectPageQueriesProjectConfigQuery($id: ID!) {
    project: node(id: $id) {
      id
      ...ProjectConfigPage_projectConfigCard
      ...ProjectRetentionPolicyCard_policy
    }
    ...ProjectRetentionPolicyCard_query
  }
`;

export const ProjectPageQueryReferenceContext = createContext<{
  spansQueryReference: PreloadedQuery<ProjectPageSpansQueryType> | null;
  spansFilterSeed: SpanFilterSeed | null;
  spansFilterSeedVersion: number;
  sessionsQueryReference: PreloadedQuery<ProjectPageSessionsQueryType> | null;
  tracesQueryReference: PreloadedQuery<ProjectPageTracesQueryType> | null;
  projectConfigQueryReference: PreloadedQuery<ProjectPageProjectConfigQueryType> | null;
}>({
  spansQueryReference: null,
  spansFilterSeed: null,
  spansFilterSeedVersion: 0,
  sessionsQueryReference: null,
  tracesQueryReference: null,
  projectConfigQueryReference: null,
});

export const useProjectPageQueryReferenceContext = () => {
  const context = useContext(ProjectPageQueryReferenceContext);
  if (!context) {
    throw new Error("ProjectPageQueryReferenceContext not found");
  }
  return context;
};
