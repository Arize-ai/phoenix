import { Suspense } from "react";
import type { PreloadedQuery } from "react-relay";
import { usePreloadedQuery } from "react-relay";
import { Outlet } from "react-router";

import { Loading } from "@phoenix/components/core/loading/Loading";
import { ErrorBoundary } from "@phoenix/components/exception";
import { PendingSpanFilter } from "@phoenix/pages/project/PendingSpanFilter";
import { SpanFilterErrorFallback } from "@phoenix/pages/project/SpanFilterErrorFallback";
import { SpanFiltersProvider } from "@phoenix/pages/project/SpanFiltersContext";
import type { SettledSpanFilterSeed } from "@phoenix/pages/project/spanFilterSeed";
import { TracesTable } from "@phoenix/pages/project/TracesTable";
import { TracePaginationProvider } from "@phoenix/pages/trace/TracePaginationContext";
import { TracingRoot } from "@phoenix/pages/TracingRoot";

import type { ProjectPageQueriesTracesQuery as ProjectPageTracesQueryType } from "./__generated__/ProjectPageQueriesTracesQuery.graphql";
import { ProjectOnboarding } from "./ProjectOnboarding";
import {
  ProjectPageQueriesTracesQuery,
  useProjectPageQueryReferenceContext,
} from "./ProjectPageQueries";

/**
 * Stable module-level identity: an inline component would be a new type on
 * every render, remounting the fallback (and the field the user is typing in)
 * underneath them.
 */
function TracesFilterErrorFallback() {
  const { resolveTracesSeed } = useProjectPageQueryReferenceContext();
  return <SpanFilterErrorFallback onResolved={resolveTracesSeed} />;
}

const TracesTabContent = ({
  tracesQueryReference,
  seed,
}: {
  tracesQueryReference: PreloadedQuery<ProjectPageTracesQueryType>;
  seed: SettledSpanFilterSeed;
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

  return <TracesTable project={data.project} seed={seed} />;
};

export const ProjectTracesPage = () => {
  const { tracesQueryReference, tracesFilterSeed, resolveTracesSeed } =
    useProjectPageQueryReferenceContext();
  const isReady = tracesQueryReference !== null && tracesFilterSeed !== null;

  return (
    <TracingRoot>
      <TracePaginationProvider>
        <SpanFiltersProvider
          key={tracesFilterSeed ? tracesFilterSeed.condition : "pending"}
          fallbackFilterCondition={tracesFilterSeed?.condition ?? ""}
        >
          {/* A condition the server called valid can still be rejected by the
              database when the query runs, which Relay rethrows during render.
              Without this the whole page is replaced by the route-level error
              element. The boundary sits inside the provider so a resolved seed
              -- a new `key` -- remounts it along with the table. */}
          <ErrorBoundary fallback={TracesFilterErrorFallback}>
            <Suspense fallback={<Loading />}>
              {isReady ? (
                <TracesTabContent
                  tracesQueryReference={tracesQueryReference}
                  seed={tracesFilterSeed}
                />
              ) : tracesFilterSeed === null ? (
                <PendingSpanFilter onResolved={resolveTracesSeed} />
              ) : (
                <Loading />
              )}
            </Suspense>
          </ErrorBoundary>
        </SpanFiltersProvider>
        <Suspense>
          <Outlet />
        </Suspense>
      </TracePaginationProvider>
    </TracingRoot>
  );
};
