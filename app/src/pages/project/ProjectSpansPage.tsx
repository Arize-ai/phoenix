import { Suspense } from "react";
import type { PreloadedQuery } from "react-relay";
import { usePreloadedQuery } from "react-relay";
import { Outlet } from "react-router";

import { Loading } from "@phoenix/components";
import { DEFAULT_SPAN_FILTER_CONDITION } from "@phoenix/pages/project/spanFilterRootScopeConstants";
import { SpanFiltersProvider } from "@phoenix/pages/project/SpanFiltersContext";
import { SpansTable } from "@phoenix/pages/project/SpansTable";
import { TracePaginationProvider } from "@phoenix/pages/trace/TracePaginationContext";
import { TracingRoot } from "@phoenix/pages/TracingRoot";
import { SPAN_FILTER_CONDITION_KEY } from "@phoenix/utils/scopedFragmentState";

import type { ProjectPageQueriesSpansQuery as ProjectPageSpansQueryType } from "./__generated__/ProjectPageQueriesSpansQuery.graphql";
import { PendingSpanFilter } from "./PendingSpanFilter";
import { ProjectOnboarding } from "./ProjectOnboarding";
import {
  ProjectPageQueriesSpansQuery,
  useProjectPageQueryReferenceContext,
} from "./ProjectPageQueries";
import type { SettledSpanFilterSeed } from "./spanFilterSeed";

function SpansTabContent({
  queryReference,
  seed,
}: {
  queryReference: PreloadedQuery<ProjectPageSpansQueryType>;
  seed: SettledSpanFilterSeed;
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

  return (
    <SpansTable
      project={data.project}
      seed={seed}
      fragmentKey={SPAN_FILTER_CONDITION_KEY}
    />
  );
}

export const ProjectSpansPage = () => {
  const { spansQueryReference, spansFilterSeed, resolveSpansSeed } =
    useProjectPageQueryReferenceContext();
  const hasSpansQuery =
    spansQueryReference !== null && spansFilterSeed !== null;
  // Keyed on the condition, not a counter: re-resolving the same filter must
  // not remount the editor and table. A genuinely new condition still does,
  // which is what resets the editor.
  const seedKey = spansFilterSeed
    ? `seed-${spansFilterSeed.condition}`
    : "seed-pending";
  return (
    <TracingRoot>
      <TracePaginationProvider>
        <SpanFiltersProvider
          key={seedKey}
          fragmentKey={SPAN_FILTER_CONDITION_KEY}
          fallbackFilterCondition={
            spansFilterSeed?.condition ?? DEFAULT_SPAN_FILTER_CONDITION
          }
        >
          <Suspense fallback={<Loading />}>
            {hasSpansQuery ? (
              <SpansTabContent
                queryReference={spansQueryReference}
                seed={spansFilterSeed}
              />
            ) : spansFilterSeed === null ? (
              // Waiting on validation: the field has to be on screen, because
              // it is what validates.
              <PendingSpanFilter onResolved={resolveSpansSeed} />
            ) : (
              // Waiting only on the query. Showing the field here would mount
              // the toolbar, tear it down, and rebuild it inside the table.
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
