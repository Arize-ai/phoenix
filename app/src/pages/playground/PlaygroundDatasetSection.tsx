import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useNavigate } from "react-router";

import { Button, Flex, Icon, Icons, Text, View } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { PlaygroundDatasetSectionQuery } from "./__generated__/PlaygroundDatasetSectionQuery.graphql";
import { PlaygroundDatasetExamplesTable } from "./PlaygroundDatasetExamplesTable";
import { PlaygroundDatasetExamplesTableProvider } from "./PlaygroundDatasetExamplesTableContext";

export function PlaygroundDatasetSection({ datasetId }: { datasetId: string }) {
  const instances = usePlaygroundContext((state) => state.instances);
  const isRunning = instances.some((instance) => instance.activeRunId != null);
  const experimentIds = useMemo(() => {
    return instances
      .map((instance) => instance.experimentId)
      .filter((id) => id != null);
  }, [instances]);
  const navigate = useNavigate();

  const data = useLazyLoadQuery<PlaygroundDatasetSectionQuery>(
    graphql`
      query PlaygroundDatasetSectionQuery($datasetId: ID!) {
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
        flex="none"
        backgroundColor={"dark"}
        paddingX="size-200"
        paddingY={"size-100"}
        borderBottomColor={"light"}
        borderBottomWidth={"thin"}
        height={50}
      >
        <Flex justifyContent="space-between" alignItems="center" height="100%">
          <Flex gap="size-100">
            <Text>{data.dataset.name ?? "Dataset"} results</Text>
            {data.dataset.exampleCount != null ? (
              <Text fontStyle="italic" color={"text-700"}>
                {data.dataset.exampleCount} examples
              </Text>
            ) : null}
          </Flex>
          {experimentIds.length > 0 && (
            <Button
              size="S"
              isDisabled={isRunning}
              leadingVisual={
                <Icon
                  svg={
                    isRunning ? (
                      <Icons.LoadingOutline />
                    ) : (
                      <Icons.ExperimentOutline />
                    )
                  }
                />
              }
              onPress={() => {
                navigate(
                  `/datasets/${datasetId}/compare?experimentId=${experimentIds.join("&experimentId=")}`
                );
              }}
            >
              View Experiment{instances.length > 1 ? "s" : ""}
            </Button>
          )}
        </Flex>
      </View>
      <PlaygroundDatasetExamplesTableProvider>
        <PlaygroundDatasetExamplesTable datasetId={datasetId} />
      </PlaygroundDatasetExamplesTableProvider>
    </Flex>
  );
}
