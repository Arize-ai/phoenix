import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useNavigate } from "react-router";
import { css } from "@emotion/react";

import { Button, Flex, Icon, Icons, Text, View } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { PlaygroundDatasetSectionQuery } from "./__generated__/PlaygroundDatasetSectionQuery.graphql";
import { PlaygroundDatasetExamplesTable } from "./PlaygroundDatasetExamplesTable";

function RunInProgressText() {
  return (
    <span
      css={css`
        color: var(--ac-global-text-color-700);
        display: inline-flex;
        .dots {
          display: inline-block;
          width: 3ch;
          overflow: hidden;
        }

        .dots::after {
          content: "...";
          display: inline-block;
          animation: dots 1.5s steps(4) infinite;
        }

        @keyframes dots {
          0% {
            content: "";
          }
          25% {
            content: ".";
          }
          50% {
            content: "..";
          }
          75% {
            content: "...";
          }
        }
      `}
    >
      Run in progress
      <span className="dots" />
    </span>
  );
}

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
            {isRunning && <RunInProgressText />}
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
