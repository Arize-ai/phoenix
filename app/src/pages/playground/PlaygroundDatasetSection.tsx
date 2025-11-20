import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Flex, Icon, Icons, LinkButton, Text, View } from "@phoenix/components";
import { DatasetSplits } from "@phoenix/components/datasetSplit/DatasetSplits";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { PlaygroundDatasetSectionQuery } from "./__generated__/PlaygroundDatasetSectionQuery.graphql";
import { PlaygroundDatasetExamplesTable } from "./PlaygroundDatasetExamplesTable";
import { PlaygroundDatasetExamplesTableProvider } from "./PlaygroundDatasetExamplesTableContext";

export function PlaygroundDatasetSection({
  datasetId,
  splitIds,
}: {
  datasetId: string;
  splitIds?: string[];
}) {
  const instances = usePlaygroundContext((state) => state.instances);
  const isRunning = instances.some((instance) => instance.activeRunId != null);
  const experimentIds = useMemo(() => {
    return instances
      .map((instance) => instance.experimentId)
      .filter((id) => id != null);
  }, [instances]);

  const data = useLazyLoadQuery<PlaygroundDatasetSectionQuery>(
    graphql`
      query PlaygroundDatasetSectionQuery($datasetId: ID!, $splitIds: [ID!]) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            name
            exampleCount(splitIds: $splitIds)
            splits {
              id
              name
              color
            }
          }
        }
      }
    `,
    {
      datasetId,
      splitIds: splitIds ?? null,
    }
  );

  // Filter to only the selected splits
  const selectedSplits = useMemo(() => {
    if (!splitIds || !data.dataset.splits) {
      return [];
    }
    return data.dataset.splits
      .filter((split) => splitIds.includes(split.id))
      .map((split) => ({
        id: split.id,
        name: split.name,
        color: split.color ?? "#808080",
      }));
  }, [data, splitIds]);
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
          <Flex gap="size-100" alignItems="center">
            <Text>{data.dataset.name ?? "Dataset"} results</Text>
            {selectedSplits.length > 0 && (
              <DatasetSplits labels={selectedSplits} />
            )}
            {data.dataset.exampleCount != null ? (
              <Text fontStyle="italic" color={"text-700"}>
                {data.dataset.exampleCount} examples
              </Text>
            ) : null}
          </Flex>
          {experimentIds.length > 0 && (
            <LinkButton
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
              to={`/datasets/${datasetId}/compare?${experimentIds.map((id) => `experimentId=${id}`).join("&")}`}
            >
              View Experiment{instances.length > 1 ? "s" : ""}
            </LinkButton>
          )}
        </Flex>
      </View>
      <PlaygroundDatasetExamplesTableProvider>
        <PlaygroundDatasetExamplesTable
          datasetId={datasetId}
          splitIds={splitIds}
        />
      </PlaygroundDatasetExamplesTableProvider>
    </Flex>
  );
}
