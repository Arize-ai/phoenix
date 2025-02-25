import { createContext, useContext } from "react";
import { graphql, PreloadedQuery } from "react-relay";

import { ProjectPageQueriesSessionsQuery as ProjectPageSessionsQueryType } from "./__generated__/ProjectPageQueriesSessionsQuery.graphql";
import { ProjectPageQueriesSpansQuery as ProjectPageSpansQueryType } from "./__generated__/ProjectPageQueriesSpansQuery.graphql";

export const ProjectPageQueriesSpansQuery = graphql`
  query ProjectPageQueriesSpansQuery($id: GlobalID!, $timeRange: TimeRange!) {
    project: node(id: $id) {
      ...SpansTable_spans
    }
  }
`;

export const ProjectPageQueriesSessionsQuery = graphql`
  query ProjectPageQueriesSessionsQuery(
    $id: GlobalID!
    $timeRange: TimeRange!
  ) {
    project: node(id: $id) {
      ...SessionsTable_sessions
    }
  }
`;

export const ProjectPageQueryReferenceContext = createContext<{
  spansQueryReference: PreloadedQuery<ProjectPageSpansQueryType> | null;
  sessionsQueryReference: PreloadedQuery<ProjectPageSessionsQueryType> | null;
}>({
  spansQueryReference: null,
  sessionsQueryReference: null,
});

export const useProjectPageQueryReferenceContext = () => {
  const context = useContext(ProjectPageQueryReferenceContext);
  if (!context) {
    throw new Error("ProjectPageQueryReferenceContext not found");
  }
  return context;
};
