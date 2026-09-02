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
import {
  SessionFiltersProvider,
  useSessionFilters,
} from "./SessionFiltersContext";

// Module-level so the identity is stable: an inline component would remount the
// field on every render.
function SessionsFilterErrorFallback({ error }: ErrorBoundaryFallbackProps) {
  const { resolveSessionsSeed } = useProjectPageQueryReferenceContext();
  const { filterCondition } = useSessionFilters();
  return (
    <DSLFilterErrorFallback
      error={error}
      hasUserFilter={filterCondition.trim() !== ""}
    >
      <SessionFilterConditionFieldWithVocabulary
        onValidCondition={({ condition, isInitialSettlement }) => {
          // The mounted condition is the one that just failed, and it
          // revalidates just as cleanly, so only an edit should reload.
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
  // Keyed on the condition, not a counter: re-resolving the same filter must
  // not remount the editor and table. A genuinely new condition still does,
  // which is what resets the editor.
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
                // Waiting on validation: the field has to be on screen, because
                // it is what validates. A rejected condition falls back to no
                // filter, with the URL keeping the rejected text.
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
                // Waiting only on the query. Showing the field here would mount
                // the toolbar, tear it down, and rebuild it inside the table.
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
