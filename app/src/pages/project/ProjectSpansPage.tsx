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

import type { ProjectPageQueriesSpansQuery as ProjectPageSpansQueryType } from "./__generated__/ProjectPageQueriesSpansQuery.graphql";
import { PendingSpanFilter } from "./PendingSpanFilter";
import { ProjectOnboarding } from "./ProjectOnboarding";
import {
  ProjectPageQueriesSpansQuery,
  useProjectPageQueryReferenceContext,
} from "./ProjectPageQueries";
import type { SpanFilterSeed } from "./spanFilterSeed";

function SpansTabContent({
  queryReference,
  seed,
}: {
  queryReference: PreloadedQuery<ProjectPageSpansQueryType>;
  seed: SpanFilterSeed;
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

  return <SpansTable project={data.project} seed={seed} />;
}

export const ProjectSpansPage = () => {
  const {
    spansQueryReference,
    spansFilterSeed,
    spansFilterSeedVersion,
    resolveSpansSeed,
  } = useProjectPageQueryReferenceContext();
  const hasSpansQuery =
    spansQueryReference !== null && spansFilterSeed !== null;
  const seedKey = spansFilterSeed
    ? `seed-${spansFilterSeedVersion}`
    : "seed-pending";
  return (
    <TracingRoot>
      <TracePaginationProvider>
        <SpanFiltersProvider
          key={seedKey}
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
            ) : (
              <PendingSpanFilter onResolved={resolveSpansSeed} />
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
