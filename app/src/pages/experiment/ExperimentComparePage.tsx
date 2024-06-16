import React, { startTransition, Suspense } from "react";
import { useLoaderData, useSearchParams } from "react-router-dom";

import { Alert, Flex, Heading, View } from "@arizeai/components";

import { Loading } from "@phoenix/components";

import { experimentCompareLoaderQuery$data } from "./__generated__/experimentCompareLoaderQuery.graphql";
import { ExperimentCompareTable } from "./ExperimentCompareTable";
import { ExperimentMultiSelector } from "./ExperimentMultiSelector";

export function ExperimentComparePage() {
  const data = useLoaderData() as experimentCompareLoaderQuery$data;
  const [searchParams, setSearchParams] = useSearchParams();
  const experimentIds = searchParams.getAll("experimentId");
  const experimentIdsSelected = experimentIds.length > 0;
  return (
    <main>
      <View
        padding="size-200"
        borderBottomColor="dark"
        borderBottomWidth="thin"
      >
        <Flex direction="column" gap="size-100">
          <Heading level={1}>Compare Experiments</Heading>
          <ExperimentMultiSelector
            dataset={data.dataset}
            selectedExperimentIds={experimentIds}
            label="experiments"
            onChange={(newExperimentIds) => {
              startTransition(() => {
                searchParams.delete("experimentId");
                newExperimentIds.forEach((id) => {
                  searchParams.append("experimentId", id);
                });
                setSearchParams(searchParams);
              });
            }}
          />
        </Flex>
      </View>
      {experimentIdsSelected ? (
        <Suspense fallback={<Loading />}>
          <ExperimentCompareTable
            datasetId={data.dataset.id}
            experimentIds={experimentIds}
            baselineExperimentId={experimentIds[0]}
          />
        </Suspense>
      ) : (
        <View padding="size-200">
          <Alert variant="info" title="No Experiment Selected">
            Please select at least 1 experiment
          </Alert>
        </View>
      )}
    </main>
  );
}
