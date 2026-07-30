import { Suspense } from "react";
import type { PreloadedQuery } from "react-relay";
import { usePreloadedQuery } from "react-relay";
import { Outlet } from "react-router";

import { Loading } from "@phoenix/components/core/loading/Loading";
import { PendingSpanFilter } from "@phoenix/pages/project/PendingSpanFilter";
import { SpanFiltersProvider } from "@phoenix/pages/project/SpanFiltersContext";
import type { SettledSpanFilterSeed } from "@phoenix/pages/project/spanFilterSeed";
import { TracesTable } from "@phoenix/pages/project/TracesTable";
import { TracePaginationProvider } from "@phoenix/pages/trace/TracePaginationContext";
import { TracingRoot } from "@phoenix/pages/TracingRoot";
import { TRACE_FILTER_CONDITION_KEY } from "@phoenix/utils/scopedFragmentState";

import type { ProjectPageQueriesTracesQuery as ProjectPageTracesQueryType } from "./__generated__/ProjectPageQueriesTracesQuery.graphql";
import { ProjectOnboarding } from "./ProjectOnboarding";
import {
  ProjectPageQueriesTracesQuery,
  useProjectPageQueryReferenceContext,
} from "./ProjectPageQueries";

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

  return (
    <TracesTable
      project={data.project}
      seed={seed}
      fragmentKey={TRACE_FILTER_CONDITION_KEY}
    />
  );
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
          fragmentKey={TRACE_FILTER_CONDITION_KEY}
          fallbackFilterCondition={tracesFilterSeed?.condition ?? ""}
        >
          <Suspense fallback={<Loading />}>
            {isReady ? (
              <TracesTabContent
                tracesQueryReference={tracesQueryReference}
                seed={tracesFilterSeed}
              />
            ) : tracesFilterSeed === null ? (
              <PendingSpanFilter
                onResolved={resolveTracesSeed}
                // The traces tab shows every span when the URL carries no
                // condition, so a rejected one must not narrow it to roots.
                fallbackCondition=""
              />
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
