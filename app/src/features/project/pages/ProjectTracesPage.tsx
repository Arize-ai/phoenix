import { Suspense } from "react";
import type { PreloadedQuery } from "react-relay";
import { usePreloadedQuery } from "react-relay";
import { Outlet } from "react-router";

import { Loading } from "@phoenix/components/loading/Loading";
import { SpanFilterConditionProvider } from "@phoenix/features/project/pages/SpanFilterConditionContext";
import { TracesTable } from "@phoenix/features/project/pages/TracesTable";
import { TracePaginationProvider } from "@phoenix/features/trace/pages/TracePaginationContext";
import { TracingRoot } from "@phoenix/pages/TracingRoot";

import type { ProjectPageQueriesTracesQuery as ProjectPageTracesQueryType } from "./__generated__/ProjectPageQueriesTracesQuery.graphql";
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
        <SpanFilterConditionProvider>
          <Suspense fallback={<Loading />}>
            <TracesTabContent tracesQueryReference={tracesQueryReference} />
          </Suspense>
        </SpanFilterConditionProvider>
        <Suspense>
          <Outlet />
        </Suspense>
      </TracePaginationProvider>
    </TracingRoot>
  );
};
