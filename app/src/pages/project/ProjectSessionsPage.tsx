import { Suspense } from "react";
import { PreloadedQuery, usePreloadedQuery } from "react-relay";
import { Outlet } from "react-router";

import { Loading } from "@phoenix/components";
import {
  ProjectPageQueriesSessionsQuery,
  useProjectPageQueryReferenceContext,
} from "@phoenix/pages/project/ProjectPageQueries";
import { SessionSearchProvider } from "@phoenix/pages/project/SessionSearchContext";
import { SessionsTable } from "@phoenix/pages/project/SessionsTable";
import { SpanFilterConditionProvider } from "@phoenix/pages/project/SpanFilterConditionContext";
import { TracingRoot } from "@phoenix/pages/TracingRoot";

import { ProjectPageQueriesSessionsQuery as ProjectPageSessionsQueryType } from "./__generated__/ProjectPageQueriesSessionsQuery.graphql";

function SessionsTabContent({
  queryReference,
}: {
  queryReference: PreloadedQuery<ProjectPageSessionsQueryType>;
}) {
  const data = usePreloadedQuery(
    ProjectPageQueriesSessionsQuery,
    queryReference
  );
  return (
    <SessionSearchProvider>
      <SessionsTable project={data.project} />
    </SessionSearchProvider>
  );
}

export const ProjectSessionsPage = () => {
  const { sessionsQueryReference } = useProjectPageQueryReferenceContext();
  if (!sessionsQueryReference) {
    return null;
  }
  return (
    <TracingRoot>
      <SpanFilterConditionProvider>
        <Suspense fallback={<Loading />}>
          <SessionsTabContent queryReference={sessionsQueryReference} />
        </Suspense>
      </SpanFilterConditionProvider>
      <Suspense>
        <Outlet />
      </Suspense>
    </TracingRoot>
  );
};
