import { useMemo } from "react";

import {
  ExternalLinkButton,
  Flex,
  Icon,
  Icons,
  RecordIcon,
  Timer,
} from "@phoenix/components";
import { ProgressCircle } from "@phoenix/components/core/progress/ProgressCircle";
import { Switch } from "@phoenix/components/core/switch";
import type { EvaluatorItem } from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import type { PlaygroundDatasetSection_evaluator$data } from "@phoenix/pages/playground/__generated__/PlaygroundDatasetSection_evaluator.graphql";
import type { PlaygroundEvaluatorSelect_query$key } from "@phoenix/pages/playground/__generated__/PlaygroundEvaluatorSelect_query.graphql";
import { PlaygroundDatasetSelect } from "@phoenix/pages/playground/PlaygroundDatasetSelect";
import type { EditingEvaluator } from "@phoenix/pages/playground/playgroundEvaluatorEditing";
import { PlaygroundEvaluatorSelect } from "@phoenix/pages/playground/PlaygroundEvaluatorSelect";
import { PlaygroundExperimentSettingsButton } from "@phoenix/pages/playground/PlaygroundExperimentSettingsButton";
import { prependBasename } from "@phoenix/utils/routingUtils";

type DatasetEvaluatorNode = PlaygroundDatasetSection_evaluator$data;

type PlaygroundExperimentToolbarProps = {
  datasetId: string;
  datasetEvaluators: (DatasetEvaluatorNode & EvaluatorItem)[];
  selectedDatasetEvaluatorIds: string[];
  onSelectionChange: (ids: string[]) => void;
  updateConnectionIds: string[];
  onEvaluatorCreated: (datasetEvaluatorId: string) => void;
  query: PlaygroundEvaluatorSelect_query$key;
  isCodeEvaluatorFormOpen: boolean;
  onCodeEvaluatorFormOpenChange: (isOpen: boolean) => void;
  isLlmEvaluatorFormOpen: boolean;
  onLlmEvaluatorFormOpenChange: (isOpen: boolean) => void;
  editingEvaluator: EditingEvaluator | null;
  onEditingEvaluatorChange: (editing: EditingEvaluator | null) => void;
};

export function PlaygroundExperimentToolbar({
  datasetId,
  datasetEvaluators,
  selectedDatasetEvaluatorIds,
  onSelectionChange,
  updateConnectionIds,
  onEvaluatorCreated,
  query,
  isCodeEvaluatorFormOpen,
  onCodeEvaluatorFormOpenChange,
  isLlmEvaluatorFormOpen,
  onLlmEvaluatorFormOpenChange,
  editingEvaluator,
  onEditingEvaluatorChange,
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
    <Flex direction="row" gap="size-100" alignItems="center">
      {experimentIds.length > 0 && !isRunning ? (
        <ExternalLinkButton
          size="S"
          isDisabled={isRunning}
          variant="quiet"
          trailingVisual={<Icon svg={<Icons.ExternalLink />} />}
          href={prependBasename(
            `/datasets/${datasetId}/compare?${experimentIds.map((id) => `experimentId=${id}`).join("&")}`
          )}
        >
          View Experiment{instances.length > 1 ? "s" : ""}
        </ExternalLinkButton>
      ) : null}
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
          size="S"
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
        isCodeEvaluatorFormOpen={isCodeEvaluatorFormOpen}
        onCodeEvaluatorFormOpenChange={onCodeEvaluatorFormOpenChange}
        isLlmEvaluatorFormOpen={isLlmEvaluatorFormOpen}
        onLlmEvaluatorFormOpenChange={onLlmEvaluatorFormOpenChange}
        editingEvaluator={editingEvaluator}
        onEditingEvaluatorChange={onEditingEvaluatorChange}
      />
      <PlaygroundDatasetSelect isDisabled={isRunning} />
      <PlaygroundExperimentSettingsButton
        isDisabled={isRunning}
        datasetId={datasetId}
      />
    </Flex>
  );
}
