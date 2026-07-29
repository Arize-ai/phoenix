import { useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { useTimeRange } from "@phoenix/components/datetime";
import { ProjectProvider } from "@phoenix/contexts/ProjectContext";
import { StreamStateProvider } from "@phoenix/contexts/StreamStateContext";
import { TracingProvider } from "@phoenix/contexts/TracingContext";
import type { DatasetEvaluatorSpansQuery } from "@phoenix/pages/dataset/evaluators/__generated__/DatasetEvaluatorSpansQuery.graphql";
import { STRICT_ROOT_SPANS_CONDITION } from "@phoenix/pages/project/spanFilterRootScopeConstants";
import {
  SpanFiltersProvider,
  useInitialSpanFilterCondition,
} from "@phoenix/pages/project/SpanFiltersContext";
import { spanFilterSeed } from "@phoenix/pages/project/spanFilterSeed";
import { SpansTable } from "@phoenix/pages/project/SpansTable";

export function DatasetEvaluatorSpans({ projectId }: { projectId: string }) {
  // Reset the mount-time filter and time-range seed if this component is reused
  // for a different project.
  return <DatasetEvaluatorSpansContent key={projectId} projectId={projectId} />;
}

function DatasetEvaluatorSpansContent({ projectId }: { projectId: string }) {
  const { timeRangeISOStrings } = useTimeRange();
  // The table owns time-range liveness through its filtered refetch. Holding
  // the parent query to its mount-time window prevents a competing parent
  // response from replacing a custom-filter connection when the range moves.
  const [initialTimeRangeISOStrings] = useState(() => timeRangeISOStrings);
  // Read once at mount. The table writes each applied filter back to the URL,
  // and deriving the variables from the live param would re-execute this query
  // on every such write -- unfiltered, since an applied condition is
  // not one of the literal conditions exempt from validation -- clobbering the
  // table's filtered rows.
  const initialFilterCondition = useInitialSpanFilterCondition(
    STRICT_ROOT_SPANS_CONDITION
  );
  // Resolve one seed for the preload, editor, and table. A seed exempt from
  // server validation arrives already filtered and costs no second query. Any
  // other seed is withheld until the server validates it.
  const [seed] = useState(() => spanFilterSeed(initialFilterCondition));
  const data = useLazyLoadQuery<DatasetEvaluatorSpansQuery>(
    graphql`
      query DatasetEvaluatorSpansQuery(
        $id: ID!
        $timeRange: TimeRange!
        $filterCondition: String
        $rootSpansOnly: Boolean!
      ) {
        project: node(id: $id) {
          ... on Project {
            ...SpansTable_spans
              @arguments(
                filterCondition: $filterCondition
                rootSpansOnly: $rootSpansOnly
              )
          }
        }
      }
    `,
    {
      id: projectId,
      timeRange: initialTimeRangeISOStrings,
      filterCondition: seed.requiresServerValidation
        ? null
        : seed.condition || null,
      rootSpansOnly: seed.requiresServerValidation ? false : seed.rootSpansOnly,
    },
    {
      fetchPolicy: "store-and-network",
      fetchKey: projectId,
    }
  );
  return (
    <ProjectProvider projectId={projectId}>
      <StreamStateProvider>
        <TracingProvider projectId={projectId} tableId="spans">
          <SpanFiltersProvider fallbackFilterCondition={seed.condition}>
            <SpansTable project={data.project} seed={seed} />
          </SpanFiltersProvider>
        </TracingProvider>
      </StreamStateProvider>
    </ProjectProvider>
  );
}
