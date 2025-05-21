import { createContext, useContext } from "react";
import { graphql, PreloadedQuery } from "react-relay";

import { ProjectPageQueriesProjectConfigQuery as ProjectPageProjectConfigQueryType } from "./__generated__/ProjectPageQueriesProjectConfigQuery.graphql";
import { ProjectPageQueriesSessionsQuery as ProjectPageSessionsQueryType } from "./__generated__/ProjectPageQueriesSessionsQuery.graphql";
import { ProjectPageQueriesSpansQuery as ProjectPageSpansQueryType } from "./__generated__/ProjectPageQueriesSpansQuery.graphql";
import { ProjectPageQueriesTracesQuery as ProjectPageTracesQueryType } from "./__generated__/ProjectPageQueriesTracesQuery.graphql";
export const ProjectPageQueriesTracesQuery = graphql`
  query ProjectPageQueriesTracesQuery($id: ID!, $timeRange: TimeRange!) {
    project: node(id: $id) {
      ...TracesTable_spans
    }
  }
`;

export const ProjectPageQueriesSpansQuery = graphql`
  query ProjectPageQueriesSpansQuery(
    $id: ID!
    $timeRange: TimeRange!
    $orphanSpanAsRootSpan: Boolean!
  ) {
    project: node(id: $id) {
      ...SpansTable_spans
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
  sessionsQueryReference: PreloadedQuery<ProjectPageSessionsQueryType> | null;
  tracesQueryReference: PreloadedQuery<ProjectPageTracesQueryType> | null;
  projectConfigQueryReference: PreloadedQuery<ProjectPageProjectConfigQueryType> | null;
}>({
  spansQueryReference: null,
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
