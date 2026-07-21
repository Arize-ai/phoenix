import { Suspense } from "react";
import type { PreloadedQuery } from "react-relay";
import { usePreloadedQuery } from "react-relay";
import { Outlet } from "react-router";

import { Loading } from "@phoenix/components";
import { DEFAULT_SPAN_FILTER_CONDITION } from "@phoenix/pages/project/spanFilterRootScope";
import { SpanFiltersProvider } from "@phoenix/pages/project/SpanFiltersContext";
import { SpansTable } from "@phoenix/pages/project/SpansTable";
import { TracePaginationProvider } from "@phoenix/pages/trace/TracePaginationContext";
import { TracingRoot } from "@phoenix/pages/TracingRoot";

import type { ProjectPageQueriesSpansQuery as ProjectPageSpansQueryType } from "./__generated__/ProjectPageQueriesSpansQuery.graphql";
import { ProjectOnboarding } from "./ProjectOnboarding";
import {
  ProjectPageQueriesSpansQuery,
  useProjectPageQueryReferenceContext,
} from "./ProjectPageQueries";

function SpansTabContent({
  queryReference,
}: {
  queryReference: PreloadedQuery<ProjectPageSpansQueryType>;
}) {
  const data = usePreloadedQuery<ProjectPageSpansQueryType>(
    ProjectPageQueriesSpansQuery,
    queryReference
  );

  if (!data.project.hasTraces) {
    return (
      <ProjectOnboarding projectName={data.project.name ?? "my-project"} />
    );
  }

  return <SpansTable project={data.project} />;
}

export const ProjectSpansPage = () => {
  const { spansQueryReference } = useProjectPageQueryReferenceContext();
  return (
    <TracingRoot>
      <TracePaginationProvider>
        <SpanFiltersProvider
          defaultFilterCondition={DEFAULT_SPAN_FILTER_CONDITION}
        >
          <Suspense fallback={<Loading />}>
            {spansQueryReference ? (
              <SpansTabContent queryReference={spansQueryReference} />
            ) : (
              <Loading />
            )}
          </Suspense>
        </SpanFiltersProvider>
        <Suspense>
          <Outlet />
        </Suspense>
      </TracePaginationProvider>
    </TracingRoot>
  );
};
