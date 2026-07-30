import { Suspense } from "react";
import type { PreloadedQuery } from "react-relay";
import { usePreloadedQuery } from "react-relay";
import { Outlet } from "react-router";

import { Loading, View } from "@phoenix/components";
import { DEFAULT_SPAN_FILTER_CONDITION } from "@phoenix/pages/project/spanFilterRootScopeConstants";
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
import { SpanFilterConditionField } from "./SpanFilterConditionField";
import type { SettledSpanFilterSeed, SpanFilterSeed } from "./spanFilterSeed";

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

/**
 * The filter field, standing in for the table while a condition is validated.
 *
 * Nothing loads until the condition settles, so the table cannot mount -- and
 * the field it normally contains is what validates. Rendering the field here
 * breaks that circle, and keeps the filter on screen while the user waits.
 */
function PendingSpansFilter({
  onResolved,
}: {
  onResolved: (seed: SettledSpanFilterSeed, persistToUrl?: boolean) => void;
}) {
  return (
    <>
      <View
        paddingTop="size-100"
        paddingBottom="size-100"
        paddingStart="size-200"
        paddingEnd="size-200"
        borderBottomColor="default"
        borderBottomWidth="thin"
        flex="none"
      >
        <SpanFilterConditionField
          onValidCondition={({ condition, selectsRootSpansOnly }) =>
            onResolved({
              condition,
              requiresServerValidation: false,
              rootSpansOnly: selectsRootSpansOnly ?? false,
            })
          }
          // A rejected or unanswerable condition still has to resolve to
          // something loadable. The default shows root spans, as a link with
          // no filter does, rather than every span -- wider than was asked
          // for. The field keeps showing the text and its own error.
          onValidationFailed={() =>
            onResolved(
              {
                condition: DEFAULT_SPAN_FILTER_CONDITION,
                requiresServerValidation: false,
                rootSpansOnly: true,
              },
              false
            )
          }
        />
      </View>
      <Loading />
    </>
  );
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
              <PendingSpansFilter onResolved={resolveSpansSeed} />
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
