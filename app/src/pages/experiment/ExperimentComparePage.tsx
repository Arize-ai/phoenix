import React from "react";
import { useLoaderData, useSearchParams } from "react-router-dom";

import { Flex, Heading, View } from "@arizeai/components";

import { experimentCompareLoaderQuery$data } from "./__generated__/experimentCompareLoaderQuery.graphql";
import { ExperimentMultiSelector } from "./ExperimentMultiSelector";

export function ExperimentComparePage() {
  const data = useLoaderData() as experimentCompareLoaderQuery$data;
  const [searchParams, setSearchParams] = useSearchParams();
  const experimentIds = searchParams.getAll("experimentId");
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
              searchParams.delete("experimentIds");
              newExperimentIds.forEach((id) => {
                searchParams.append("experimentId", id);
              });
              setSearchParams(searchParams);
            }}
          />
        </Flex>
      </View>
    </main>
  );
}
