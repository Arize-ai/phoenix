import React, { startTransition, Suspense } from "react";
import { useLoaderData, useSearchParams } from "react-router-dom";
import { css } from "@emotion/react";

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
    <main
      css={css`
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      `}
    >
      <View
        padding="size-200"
        borderBottomColor="dark"
        borderBottomWidth="thin"
        flex="none"
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
          />
        </Suspense>
      ) : (
        <View padding="size-200">
          <Alert variant="info" title="No Experiment Selected">
            Please select one or more experiments.
          </Alert>
        </View>
      )}
    </main>
  );
}
