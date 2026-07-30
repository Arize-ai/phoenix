import { Suspense } from "react";
import type { PreloadedQuery } from "react-relay";
import { usePreloadedQuery } from "react-relay";
import { Outlet } from "react-router";

import { Loading } from "@phoenix/components";
import {
  ProjectPageQueriesSessionsQuery,
  useProjectPageQueryReferenceContext,
} from "@phoenix/pages/project/ProjectPageQueries";
import { SessionSearchProvider } from "@phoenix/pages/project/SessionSearchContext";
import { SessionsTable } from "@phoenix/pages/project/SessionsTable";
import { SpanFiltersProvider } from "@phoenix/pages/project/SpanFiltersContext";
import { SessionPaginationProvider } from "@phoenix/pages/trace/SessionPaginationContext";
import { TracingRoot } from "@phoenix/pages/TracingRoot";
import { SPAN_FILTER_CONDITION_KEY } from "@phoenix/utils/scopedFragmentState";

import type { ProjectPageQueriesSessionsQuery as ProjectPageSessionsQueryType } from "./__generated__/ProjectPageQueriesSessionsQuery.graphql";

function SessionsTabContent({
  queryReference,
}: {
  queryReference: PreloadedQuery<ProjectPageSessionsQueryType>;
}) {
  const data = usePreloadedQuery<ProjectPageSessionsQueryType>(
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
      <SessionPaginationProvider>
        {/* Sessions hosts no filter field; the provider is here for the
            agent's set_spans_filter registration. The spans-tab key keeps its
            draft aligned with the tab the condition would apply to. */}
        <SpanFiltersProvider fragmentKey={SPAN_FILTER_CONDITION_KEY}>
          <Suspense fallback={<Loading />}>
            <SessionsTabContent queryReference={sessionsQueryReference} />
          </Suspense>
        </SpanFiltersProvider>
        <Suspense>
          <Outlet />
        </Suspense>
      </SessionPaginationProvider>
    </TracingRoot>
  );
};
