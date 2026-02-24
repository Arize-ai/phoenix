import { Suspense } from "react";
import type { PreloadedQuery } from "react-relay";
import { usePreloadedQuery } from "react-relay";
import { Outlet } from "react-router";

import { Loading } from "@phoenix/components";
import {
  ProjectPageQueriesSessionsQuery,
  useProjectPageQueryReferenceContext,
} from "@phoenix/features/project/pages/ProjectPageQueries";
import { SessionSearchProvider } from "@phoenix/features/project/pages/SessionSearchContext";
import { SessionsTable } from "@phoenix/features/project/pages/SessionsTable";
import { SpanFilterConditionProvider } from "@phoenix/features/project/pages/SpanFilterConditionContext";
import { TracingRoot } from "@phoenix/pages/TracingRoot";

import type { ProjectPageQueriesSessionsQuery as ProjectPageSessionsQueryType } from "./__generated__/ProjectPageQueriesSessionsQuery.graphql";

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
