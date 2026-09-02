import { Suspense } from "react";
import type { PreloadedQuery } from "react-relay";
import { usePreloadedQuery } from "react-relay";
import { Outlet } from "react-router";

import { Loading } from "@phoenix/components";
import { ErrorBoundary } from "@phoenix/components/exception";
import type { ErrorBoundaryFallbackProps } from "@phoenix/components/exception/types";
import { TracesTable } from "@phoenix/pages/project/TracesTable";
import { TracePaginationProvider } from "@phoenix/pages/trace/TracePaginationContext";
import { TracingRoot } from "@phoenix/pages/TracingRoot";

import type { ProjectPageQueriesTracesQuery as ProjectPageTracesQueryType } from "./__generated__/ProjectPageQueriesTracesQuery.graphql";
import { DSLFilterErrorFallback } from "./DSLFilterErrorFallback";
import { PendingDSLFilter } from "./PendingDSLFilter";
import { ProjectOnboarding } from "./ProjectOnboarding";
import {
  ProjectPageQueriesTracesQuery,
  useProjectPageQueryReferenceContext,
} from "./ProjectPageQueries";
import { TraceFilterConditionFieldWithVocabulary } from "./TraceFilterConditionField";
import { TraceFiltersProvider, useTraceFilters } from "./TraceFiltersContext";

// Module-level: an inline component would remount the field on every render.
function TracesFilterErrorFallback({ error }: ErrorBoundaryFallbackProps) {
  const { resolveTracesSeed } = useProjectPageQueryReferenceContext();
  const { filterCondition } = useTraceFilters();
  return (
    <DSLFilterErrorFallback
      error={error}
      hasUserFilter={filterCondition.trim() !== ""}
    >
      <TraceFilterConditionFieldWithVocabulary
        onValidCondition={({ condition, isInitialSettlement }) => {
          // The mounted condition just failed; only an edit should reload.
          if (isInitialSettlement) {
            return;
          }
          resolveTracesSeed(condition);
        }}
      />
    </DSLFilterErrorFallback>
  );
}

function TracesTabContent({
  tracesQueryReference,
  seed,
}: {
  tracesQueryReference: PreloadedQuery<ProjectPageTracesQueryType>;
  seed: string;
}) {
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
}

export const ProjectTracesPage = () => {
  const { tracesQueryReference, tracesFilterSeed, resolveTracesSeed } =
    useProjectPageQueryReferenceContext();
  const hasTracesQuery =
    tracesQueryReference !== null && tracesFilterSeed !== null;
  // Keyed on the condition so re-resolving the same filter does not remount the
  // editor and table; a new condition does, which resets the editor.
  const seedKey =
    tracesFilterSeed === null ? "seed-pending" : `seed-${tracesFilterSeed}`;
  return (
    <TracingRoot>
      <TracePaginationProvider>
        <TraceFiltersProvider key={seedKey}>
          {/* Inside the provider so a resolved seed -- a new `key` -- remounts it. */}
          <ErrorBoundary fallback={TracesFilterErrorFallback}>
            <Suspense fallback={<Loading />}>
              {hasTracesQuery ? (
                <TracesTabContent
                  tracesQueryReference={tracesQueryReference}
                  seed={tracesFilterSeed}
                />
              ) : tracesFilterSeed === null ? (
                // A rejected condition falls back to no filter; the URL keeps
                // the rejected text.
                <PendingDSLFilter
                  onValidCondition={({ condition }: { condition: string }) =>
                    resolveTracesSeed(condition)
                  }
                  onRejected={() => resolveTracesSeed("", false)}
                  renderField={(fieldProps) => (
                    <TraceFilterConditionFieldWithVocabulary {...fieldProps} />
                  )}
                />
              ) : (
                // Showing the field here would mount it twice: once now and
                // again inside the table.
                <Loading />
              )}
            </Suspense>
          </ErrorBoundary>
          <Suspense>
            <Outlet />
          </Suspense>
        </TraceFiltersProvider>
      </TracePaginationProvider>
    </TracingRoot>
  );
};
