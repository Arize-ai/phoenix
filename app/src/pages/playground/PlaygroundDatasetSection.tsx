import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useNavigate } from "react-router";

import { Button, Flex, Icon, Icons, Text, View } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { PlaygroundDatasetSectionQuery } from "./__generated__/PlaygroundDatasetSectionQuery.graphql";
import { PlaygroundDatasetExamplesTable } from "./PlaygroundDatasetExamplesTable";

export function PlaygroundDatasetSection({ datasetId }: { datasetId: string }) {
  const experimentId = usePlaygroundContext((state) => state.experimentId);
  const instances = usePlaygroundContext((state) => state.instances);
  const isRunning = instances.some((instance) => instance.activeRunId != null);
  const navigate = useNavigate();

  const data = useLazyLoadQuery<PlaygroundDatasetSectionQuery>(
    graphql`
      query PlaygroundDatasetSectionQuery($datasetId: GlobalID!) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            name
            exampleCount
          }
        }
      }
    `,
    {
      datasetId,
    }
  );
  return (
    <Flex direction={"column"} height={"100%"}>
      <View
        backgroundColor={"dark"}
        paddingX={"size-200"}
        paddingY={"size-100"}
        borderBottomColor={"light"}
        borderBottomWidth={"thin"}
      >
        <Flex justifyContent={"space-between"}>
          <Flex gap={"size-100"}>
            <Text>{data.dataset.name ?? "Dataset"} results</Text>
            {data.dataset.exampleCount != null ? (
              <Text fontStyle="italic" color={"text-700"}>
                {data.dataset.exampleCount} examples
              </Text>
            ) : null}
          </Flex>
          <Flex gap={"size-100"} alignItems={"center"}>
            {isRunning && (
              <Text color="text-700">
                Run in progress, navigating away from the page could result in
                data loss.
              </Text>
            )}
            {experimentId != null && (
              <Button
                size={"compact"}
                variant="default"
                disabled={isRunning}
                loading={isRunning}
                icon={<Icon svg={<Icons.ExperimentOutline />} />}
                onClick={() => {
                  navigate(
                    `/datasets/${datasetId}/compare?experimentId=${experimentId}`
                  );
                }}
              >
                View Experiment
              </Button>
            )}
          </Flex>
        </Flex>
      </View>
      <PlaygroundDatasetExamplesTable datasetId={datasetId} />
    </Flex>
  );
}
