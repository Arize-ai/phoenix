import { Suspense } from "react";
import { useLoaderData, useParams, useSearchParams } from "react-router";
import invariant from "tiny-invariant";

import { Alert, Loading, View } from "@phoenix/components";

import { experimentCompareGridLoader } from "./experimentCompareGridLoader";
import { ExperimentCompareTable } from "./ExperimentCompareTable";
import { ExperimentRunFilterConditionProvider } from "./ExperimentRunFilterConditionContext";

export function ExperimentCompareGridPage() {
  const [searchParams] = useSearchParams();
  const loaderData = useLoaderData<typeof experimentCompareGridLoader>();
  invariant(loaderData, "loaderData is required");
  const [baselineExperimentId = undefined, ...compareExperimentIds] =
    searchParams.getAll("experimentId");
  const { datasetId } = useParams();
  invariant(datasetId != null, "datasetId is required");
  const displayFullText = false; // todo: add to query parameters
  return baselineExperimentId != null ? (
    <ExperimentRunFilterConditionProvider>
      <Suspense fallback={<Loading />}>
        <ExperimentCompareTable
          query={loaderData}
          datasetId={datasetId}
          baselineExperimentId={baselineExperimentId}
          compareExperimentIds={compareExperimentIds}
          displayFullText={displayFullText}
        />
      </Suspense>
    </ExperimentRunFilterConditionProvider>
  ) : (
    <View padding="size-200">
      <Alert variant="info" title="No Baseline Experiment Selected">
        Please select a baseline experiment.
      </Alert>
    </View>
  );
}
