import { Suspense } from "react";
import { useLoaderData, useParams, useSearchParams } from "react-router";
import invariant from "tiny-invariant";

import { Loading } from "@phoenix/components";

import { experimentCompareLoader } from "./experimentCompareLoader";
import { ExperimentCompareTable } from "./ExperimentCompareTable";
import { ExperimentRunFilterConditionProvider } from "./ExperimentRunFilterConditionContext";

export function ExperimentCompareGridPage() {
  const [searchParams] = useSearchParams();
  const loaderData = useLoaderData<typeof experimentCompareLoader>();
  invariant(loaderData, "loaderData is required");
  const [baseExperimentId, ...compareExperimentIds] =
    searchParams.getAll("experimentId");
  const { datasetId } = useParams();
  invariant(datasetId != null, "datasetId is required");
  return (
    <ExperimentRunFilterConditionProvider>
      <Suspense fallback={<Loading />}>
        <ExperimentCompareTable
          query={loaderData}
          datasetId={datasetId}
          baseExperimentId={baseExperimentId}
          compareExperimentIds={compareExperimentIds}
        />
      </Suspense>
    </ExperimentRunFilterConditionProvider>
  );
}
