import { useMemo } from "react";
import { useStore } from "zustand";

import {
  Button,
  ExternalLinkButton,
  Flex,
  Icon,
  Icons,
  RecordIcon,
  Timer,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
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
import { PlaygroundExampleColumnSelector } from "@phoenix/pages/playground/PlaygroundExampleColumnSelector";
import { PlaygroundExperimentSettingsButton } from "@phoenix/pages/playground/PlaygroundExperimentSettingsButton";
import { getPlaygroundTaskKind } from "@phoenix/store/playground";
import type { EditableTableStore } from "@phoenix/types/table";
import { prependBasename } from "@phoenix/utils/routingUtils";

import type { PlaygroundExampleTableRow } from "./examplesEditing";

type DatasetEvaluatorNode = PlaygroundDatasetSection_evaluator$data;

type PlaygroundExperimentToolbarProps = {
  datasetId: string;
  /** Whether a loaded example has metadata to show; see the column selector. */
  hasExampleMetadata: boolean;
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
  /** The table's edit session; Edit here begins it. */
  editStore: EditableTableStore<PlaygroundExampleTableRow>;
};

export function PlaygroundExperimentToolbar({
  datasetId,
  hasExampleMetadata,
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
  editStore,
}: PlaygroundExperimentToolbarProps) {
  const isEditingExamples = useStore(
    editStore,
    (state) => state.mode !== "read"
  );
  const instances = usePlaygroundContext((state) => state.instances);
  // Dataset evaluators score a prompt's outputs; an evaluator task is the
  // judge itself, so there is nothing to attach to it.
  const isPromptKind = getPlaygroundTaskKind(instances) === "prompt";

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
      {isPromptKind ? (
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
      ) : null}
      <PlaygroundDatasetSelect isDisabled={isRunning || isEditingExamples} />
      {/* Editing happens in the table under the floating edit toolbar, so this
          only opens the session; it steps aside once one is under way. */}
      {isEditingExamples ? null : (
        <TooltipTrigger>
          <Button
            size="S"
            leadingVisual={<Icon svg={<Icons.Edit />} />}
            isDisabled={isRunning}
            onPress={() => editStore.getState().beginEditing()}
          >
            Edit
          </Button>
          <Tooltip>
            <TooltipArrow />
            Edit the dataset&apos;s examples here. Saved as a new version.
          </Tooltip>
        </TooltipTrigger>
      )}
      <PlaygroundExampleColumnSelector hasMetadata={hasExampleMetadata} />
      {/* The settings include whether the metadata column hides the
          annotations, which the edit session's cells were built against. */}
      <PlaygroundExperimentSettingsButton
        isDisabled={isRunning || isEditingExamples}
        datasetId={datasetId}
      />
    </Flex>
  );
}
