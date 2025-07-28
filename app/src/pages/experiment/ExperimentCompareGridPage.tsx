import { Suspense } from "react";
import { useLoaderData, useParams, useSearchParams } from "react-router";
import invariant from "tiny-invariant";

import { Alert, Loading, View } from "@phoenix/components";

import { experimentCompareLoader } from "./experimentCompareLoader";
import { ExperimentCompareTable } from "./ExperimentCompareTable";
import { ExperimentRunFilterConditionProvider } from "./ExperimentRunFilterConditionContext";

export type ExperimentCompareGridPageProps = {
  displayFullText: boolean;
};

export function ExperimentCompareGridPage({
  displayFullText,
}: ExperimentCompareGridPageProps) {
  const [searchParams] = useSearchParams();
  const loaderData = useLoaderData<typeof experimentCompareLoader>();
  invariant(loaderData, "loaderData is required");
  const [baselineExperimentId = undefined, ...compareExperimentIds] =
    searchParams.getAll("experimentId");
  const { datasetId } = useParams();
  invariant(datasetId != null, "datasetId is required");
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
