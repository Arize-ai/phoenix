import { Suspense } from "react";
import { PreloadedQuery, usePreloadedQuery } from "react-relay";
import { Outlet } from "react-router";

import { Loading } from "@phoenix/components";
import { SpanFilterConditionProvider } from "@phoenix/pages/project/SpanFilterConditionContext";
import { SpansTable } from "@phoenix/pages/project/SpansTable";
import { TracePaginationProvider } from "@phoenix/pages/trace/TracePaginationContext";
import { TracingRoot } from "@phoenix/pages/TracingRoot";

import { ProjectPageQueriesSpansQuery as ProjectPageSpansQueryType } from "./__generated__/ProjectPageQueriesSpansQuery.graphql";
import {
  ProjectPageQueriesSpansQuery,
  useProjectPageQueryReferenceContext,
} from "./ProjectPageQueries";

function SpansTabContent({
  queryReference,
}: {
  queryReference: PreloadedQuery<ProjectPageSpansQueryType>;
}) {
  const data = usePreloadedQuery(ProjectPageQueriesSpansQuery, queryReference);
  return <SpansTable project={data.project} />;
}

export const ProjectSpansPage = () => {
  const { spansQueryReference } = useProjectPageQueryReferenceContext();
  if (!spansQueryReference) {
    return null;
  }
  return (
    <TracingRoot>
      <TracePaginationProvider>
        <SpanFilterConditionProvider>
          <Suspense fallback={<Loading />}>
            <SpansTabContent queryReference={spansQueryReference} />
          </Suspense>
        </SpanFilterConditionProvider>
        <Suspense>
          <Outlet />
        </Suspense>
      </TracePaginationProvider>
    </TracingRoot>
  );
};
