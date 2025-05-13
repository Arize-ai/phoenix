import { startTransition, Suspense, useState } from "react";
import { useLoaderData, useSearchParams } from "react-router";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Switch } from "@arizeai/components";

import { Alert, Flex, Heading, Loading, View } from "@phoenix/components";
import { experimentCompareLoader } from "@phoenix/pages/experiment/experimentCompareLoader";

import { ExperimentCompareTable } from "./ExperimentCompareTable";
import { ExperimentMultiSelector } from "./ExperimentMultiSelector";
import { ExperimentRunFilterConditionProvider } from "./ExperimentRunFilterConditionContext";

export function ExperimentComparePage() {
  const loaderData = useLoaderData<typeof experimentCompareLoader>();
  invariant(loaderData, "loaderData is required");
  // The text of most IO is too long so default to showing truncated text
  const [displayFullText, setDisplayFullText] = useState(false);
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
          <Flex direction="row" justifyContent="space-between" alignItems="end">
            <ExperimentMultiSelector
              dataset={loaderData.dataset}
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
            <Switch
              onChange={(isSelected) => {
                setDisplayFullText(isSelected);
              }}
              defaultSelected={false}
              labelPlacement="start"
            >
              Full Text
            </Switch>
          </Flex>
        </Flex>
      </View>
      {experimentIdsSelected ? (
        <ExperimentRunFilterConditionProvider>
          <Suspense fallback={<Loading />}>
            <ExperimentCompareTable
              datasetId={loaderData.dataset.id}
              experimentIds={experimentIds}
              displayFullText={displayFullText}
            />
          </Suspense>
        </ExperimentRunFilterConditionProvider>
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
