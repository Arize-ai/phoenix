import { useMemo } from "react";

import {
  ExternalLinkButton,
  Flex,
  Heading,
  Icon,
  Icons,
  RecordIcon,
  Timer,
  View,
} from "@phoenix/components";
import { ProgressCircle } from "@phoenix/components/core/progress/ProgressCircle";
import { Switch } from "@phoenix/components/core/switch";
import type { EvaluatorItem } from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import type { PlaygroundDatasetSection_evaluator$data } from "@phoenix/pages/playground/__generated__/PlaygroundDatasetSection_evaluator.graphql";
import type { PlaygroundEvaluatorSelect_query$key } from "@phoenix/pages/playground/__generated__/PlaygroundEvaluatorSelect_query.graphql";
import { PlaygroundDatasetSelect } from "@phoenix/pages/playground/PlaygroundDatasetSelect";
import { PlaygroundEvaluatorSelect } from "@phoenix/pages/playground/PlaygroundEvaluatorSelect";
import { PlaygroundExperimentSettingsButton } from "@phoenix/pages/playground/PlaygroundExperimentSettingsButton";

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
  const recordExperiments = usePlaygroundContext(
    (state) => state.recordExperiments
  );
  const setRecordExperiments = usePlaygroundContext(
    (state) => state.setRecordExperiments
  );
  const isRunning = instances.some((instance) => instance.activeRunId != null);
  const experimentIds = useMemo(() => {
    return instances.flatMap((instance) => {
      const exp = instance.experiment;
      return exp && !exp.isEphemeral ? [exp.id] : [];
    });
  }, [instances]);
  return (
    <View
      flex="none"
      paddingX="size-200"
      paddingY={"size-100"}
      borderBottomColor={"default"}
      borderBottomWidth={"thin"}
      height={50}
    >
      <Flex justifyContent="space-between" alignItems="center" height="100%">
        <Flex gap="size-200" alignItems="center">
          <Heading level={2} weight="heavy">
            Experiment
          </Heading>
          {experimentIds.length > 0 && !isRunning ? (
            <ExternalLinkButton
              size="S"
              isDisabled={isRunning}
              variant="quiet"
              trailingVisual={<Icon svg={<Icons.ExternalLinkOutline />} />}
              href={`/datasets/${datasetId}/compare?${experimentIds.map((id) => `experimentId=${id}`).join("&")}`}
            >
              View Experiment{instances.length > 1 ? "s" : ""}
            </ExternalLinkButton>
          ) : null}
        </Flex>
        <Flex direction="row" gap="size-100" alignItems="center">
          {isRunning ? (
            <Flex alignItems="center" gap="size-100">
              {recordExperiments ? (
                <RecordIcon isActive />
              ) : (
                <ProgressCircle isIndeterminate size="S" />
              )}
              <Timer size="S" color="text-700" />
            </Flex>
          ) : (
            <Switch
              isSelected={recordExperiments}
              onChange={setRecordExperiments}
              labelPlacement="start"
            >
              Record
            </Switch>
          )}
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
          <PlaygroundExperimentSettingsButton
            isDisabled={isRunning}
            datasetId={datasetId}
          />
        </Flex>
      </Flex>
    </View>
  );
}
