import { useMemo } from "react";

import { Flex, Icon, Icons, LinkButton, Text, View } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { PlaygroundDatasetSelect } from "@phoenix/pages/playground/PlaygroundDatasetSelect";

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
            <Text>Experiment</Text>
            {experimentIds.length > 0 ? (
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
            ) : null}
          </Flex>
          <Flex direction="row" gap="size-100" alignItems="center">
            <PlaygroundDatasetSelect />
          </Flex>
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
