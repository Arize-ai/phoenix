import { Suspense } from "react";
import type { PreloadedQuery } from "react-relay";
import { usePreloadedQuery } from "react-relay";
import { Outlet } from "react-router";

import { Loading } from "@phoenix/components";
import { ErrorBoundary } from "@phoenix/components/exception";
import type { ErrorBoundaryFallbackProps } from "@phoenix/components/exception/types";
import {
  ProjectPageQueriesSessionsQuery,
  useProjectPageQueryReferenceContext,
} from "@phoenix/pages/project/ProjectPageQueries";
import { SessionsTable } from "@phoenix/pages/project/SessionsTable";
import { SessionPaginationProvider } from "@phoenix/pages/trace/SessionPaginationContext";
import { TracingRoot } from "@phoenix/pages/TracingRoot";

import type { ProjectPageQueriesSessionsQuery as ProjectPageSessionsQueryType } from "./__generated__/ProjectPageQueriesSessionsQuery.graphql";
import { DSLFilterErrorFallback } from "./DSLFilterErrorFallback";
import { PendingDSLFilter } from "./PendingDSLFilter";
import { SessionFilterConditionFieldWithVocabulary } from "./SessionFilterConditionField";
import { SessionFiltersProvider } from "./SessionFiltersContext";

// Module-level: an inline component would remount the field on every render.
function SessionsFilterErrorFallback({ error }: ErrorBoundaryFallbackProps) {
  const { resolveSessionsSeed } = useProjectPageQueryReferenceContext();
  return (
    <DSLFilterErrorFallback error={error}>
      <SessionFilterConditionFieldWithVocabulary
        onValidCondition={({ condition, isInitialSettlement }) => {
          // The mounted condition just failed; only an edit should reload.
          if (isInitialSettlement) {
            return;
          }
          resolveSessionsSeed(condition);
        }}
      />
    </DSLFilterErrorFallback>
  );
}

function SessionsTabContent({
  queryReference,
  seed,
}: {
  queryReference: PreloadedQuery<ProjectPageSessionsQueryType>;
  seed: string;
}) {
  const data = usePreloadedQuery<ProjectPageSessionsQueryType>(
    ProjectPageQueriesSessionsQuery,
    queryReference
  );
  return <SessionsTable project={data.project} seed={seed} />;
}

export const ProjectSessionsPage = () => {
  const { sessionsQueryReference, sessionsFilterSeed, resolveSessionsSeed } =
    useProjectPageQueryReferenceContext();
  const hasSessionsQuery =
    sessionsQueryReference !== null && sessionsFilterSeed !== null;
  // Keyed on the condition so re-resolving the same filter does not remount the
  // editor and table; a new condition does, which resets the editor.
  const seedKey =
    sessionsFilterSeed === null ? "seed-pending" : `seed-${sessionsFilterSeed}`;
  return (
    <TracingRoot>
      <SessionPaginationProvider>
        <SessionFiltersProvider key={seedKey}>
          {/* Inside the provider so a resolved seed -- a new `key` -- remounts it. */}
          <ErrorBoundary fallback={SessionsFilterErrorFallback}>
            <Suspense fallback={<Loading />}>
              {hasSessionsQuery ? (
                <SessionsTabContent
                  queryReference={sessionsQueryReference}
                  seed={sessionsFilterSeed}
                />
              ) : sessionsFilterSeed === null ? (
                // A rejected condition falls back to no filter; the URL keeps
                // the rejected text.
                <PendingDSLFilter
                  onValidCondition={({ condition }: { condition: string }) =>
                    resolveSessionsSeed(condition)
                  }
                  onRejected={() => resolveSessionsSeed("", false)}
                  renderField={(fieldProps) => (
                    <SessionFilterConditionFieldWithVocabulary
                      {...fieldProps}
                    />
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
        </SessionFiltersProvider>
      </SessionPaginationProvider>
    </TracingRoot>
  );
};
