import { Suspense, useMemo } from "react";
import { PreloadedQuery } from "react-relay";
import { useParams, useSearchParams } from "react-router";
import invariant from "tiny-invariant";

import { Loading } from "@phoenix/components";
import type { ExperimentComparePageQueriesCompareGridQuery as ExperimentComparePageQueriesCompareGridQueryType } from "@phoenix/pages/experiment/__generated__/ExperimentComparePageQueriesCompareGridQuery.graphql";

import { ExperimentCompareTable } from "./ExperimentCompareTable";
import { ExperimentRunFilterConditionProvider } from "./ExperimentRunFilterConditionContext";

export function ExperimentCompareGridPage({
  queryRef,
}: {
  queryRef: PreloadedQuery<ExperimentComparePageQueriesCompareGridQueryType>;
}) {
  const [searchParams] = useSearchParams();
  const { baseExperimentId, compareExperimentIds } = useMemo(() => {
    const [baseExperimentId, ...compareExperimentIds] =
      searchParams.getAll("experimentId");
    return { baseExperimentId, compareExperimentIds };
  }, [searchParams]);
  const { datasetId } = useParams();
  invariant(datasetId != null, "datasetId is required");

  return (
    <ExperimentRunFilterConditionProvider>
      <Suspense fallback={<Loading />}>
        <ExperimentCompareTable
          queryRef={queryRef}
          datasetId={datasetId}
          baseExperimentId={baseExperimentId}
          compareExperimentIds={compareExperimentIds}
        />
      </Suspense>
    </ExperimentRunFilterConditionProvider>
  );
}
