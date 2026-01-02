import { useMemo } from "react";

import {
  Flex,
  Heading,
  Icon,
  Icons,
  LinkButton,
  Text,
  View,
} from "@phoenix/components";
import { EvaluatorItem } from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { PlaygroundDatasetSection_evaluator$data } from "@phoenix/pages/playground/__generated__/PlaygroundDatasetSection_evaluator.graphql";
import { PlaygroundEvaluatorSelect_query$key } from "@phoenix/pages/playground/__generated__/PlaygroundEvaluatorSelect_query.graphql";
import { PlaygroundDatasetSelect } from "@phoenix/pages/playground/PlaygroundDatasetSelect";
import { PlaygroundEvaluatorSelect } from "@phoenix/pages/playground/PlaygroundEvaluatorSelect";

type DatasetEvaluatorNode = PlaygroundDatasetSection_evaluator$data;

type PlaygroundExperimentToolbarProps = {
  datasetId: string;
  datasetEvaluators: (DatasetEvaluatorNode & EvaluatorItem)[];
  selectedDatasetEvaluatorIds: string[];
  onSelectionChange: (ids: string[]) => void;
  updateConnectionIds: string[];
  onEvaluatorCreated: (datasetEvaluatorId: string) => void;
  query: PlaygroundEvaluatorSelect_query$key;
};

export function PlaygroundExperimentToolbar({
  datasetId,
  datasetEvaluators,
  selectedDatasetEvaluatorIds,
  onSelectionChange,
  updateConnectionIds,
  onEvaluatorCreated,
  query,
}: PlaygroundExperimentToolbarProps) {
  const instances = usePlaygroundContext((state) => state.instances);
  const isRunning = instances.some((instance) => instance.activeRunId != null);
  const experimentIds = useMemo(() => {
    return instances
      .map((instance) => instance.experimentId)
      .filter((id) => id != null);
  }, [instances]);
  return (
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
        <Flex gap="size-200" alignItems="center">
          <Heading level={2} weight="heavy">
            Experiment
          </Heading>
          {isRunning ? (
            <Flex alignItems="center" gap="size-100">
              <Icon key="loading" svg={<Icons.LoadingOutline />} />
              <Text>
                {instances.length} experiment{instances.length > 1 ? "s" : ""}{" "}
                running
              </Text>
            </Flex>
          ) : null}
          {experimentIds.length > 0 && !isRunning ? (
            <LinkButton
              size="S"
              isDisabled={isRunning}
              leadingVisual={<Icon svg={<Icons.ExperimentOutline />} />}
              to={`/datasets/${datasetId}/compare?${experimentIds.map((id) => `experimentId=${id}`).join("&")}`}
            >
              View Experiment{instances.length > 1 ? "s" : ""}
            </LinkButton>
          ) : null}
        </Flex>
        <Flex direction="row" gap="size-100" alignItems="center">
          <PlaygroundEvaluatorSelect
            evaluators={datasetEvaluators}
            selectedIds={selectedDatasetEvaluatorIds}
            onSelectionChange={onSelectionChange}
            datasetId={datasetId}
            updateConnectionIds={updateConnectionIds}
            onEvaluatorCreated={onEvaluatorCreated}
            query={query}
            isDisabled={isRunning}
          />
          <PlaygroundDatasetSelect isDisabled={isRunning} />
        </Flex>
      </Flex>
    </View>
  );
}
