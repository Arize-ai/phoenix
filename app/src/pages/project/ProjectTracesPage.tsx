import { Suspense } from "react";
import type { PreloadedQuery } from "react-relay";
import { usePreloadedQuery } from "react-relay";
import { Outlet } from "react-router";

import { Loading } from "@phoenix/components/core/loading/Loading";
import { SpanFiltersProvider } from "@phoenix/pages/project/SpanFiltersContext";
import { TracesTable } from "@phoenix/pages/project/TracesTable";
import { TracePaginationProvider } from "@phoenix/pages/trace/TracePaginationContext";
import { TracingRoot } from "@phoenix/pages/TracingRoot";

import type { ProjectPageQueriesTracesQuery as ProjectPageTracesQueryType } from "./__generated__/ProjectPageQueriesTracesQuery.graphql";
import { ProjectOnboarding } from "./ProjectOnboarding";
import {
  ProjectPageQueriesTracesQuery,
  useProjectPageQueryReferenceContext,
} from "./ProjectPageQueries";

const TracesTabContent = ({
  tracesQueryReference,
}: {
  tracesQueryReference: PreloadedQuery<ProjectPageTracesQueryType>;
}) => {
  const data = usePreloadedQuery<ProjectPageTracesQueryType>(
    ProjectPageQueriesTracesQuery,
    tracesQueryReference
  );

  if (!data.project.hasTraces) {
    return (
      <ProjectOnboarding projectName={data.project.name ?? "my-project"} />
    );
  }

  return <TracesTable project={data.project} />;
};

export const ProjectTracesPage = () => {
  const { tracesQueryReference } = useProjectPageQueryReferenceContext();

  if (!tracesQueryReference) {
    return null;
  }

  return (
    <TracingRoot>
      <TracePaginationProvider>
        <SpanFiltersProvider>
          <Suspense fallback={<Loading />}>
            <TracesTabContent tracesQueryReference={tracesQueryReference} />
          </Suspense>
        </SpanFiltersProvider>
        <Suspense>
          <Outlet />
        </Suspense>
      </TracePaginationProvider>
    </TracingRoot>
  );
};
