import React from "react";
import { useSearchParams } from "react-router-dom";

import { Flex, View } from "@arizeai/components";

import { ExperimentMultiSelector } from "./ExperimentMultiSelector";

export function ExperimentComparePage() {
  const [searchParams] = useSearchParams();
  const experimentIds = searchParams.getAll("experimentIds");
  return (
    <main>
      <View
        padding="size-200"
        borderBottomColor="dark"
        borderBottomWidth="thin"
      >
        <Flex direction="column" gap="size-100">
          {/* <Heading level={1}>Comparing Experiments</Heading> */}
          <ExperimentMultiSelector
            experiments={experimentIds}
            selectedExperimentIds={experimentIds}
            label="experiments"
            onChange={() => {
              // searchParams.set("experimentIds", selectedExperimentIds);
            }}
          />
        </Flex>
      </View>
    </main>
  );
}
