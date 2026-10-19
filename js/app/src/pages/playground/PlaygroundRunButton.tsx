import { useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useSearchParams } from "react-router";

import {
  Button,
  Icon,
  Icons,
  Keyboard,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  VisuallyHidden,
} from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useModifierKey } from "@phoenix/hooks/useModifierKey";
import { getPlaygroundTaskKind } from "@phoenix/store/playground";
import type { PlaygroundNormalizedInstance } from "@phoenix/store/playground/types";

import { DECISION_DATASET_BLOCKED_REASON } from "./constants";
import { getDecisionValidationError } from "./decisionUtils";
import { DisabledButtonTooltip } from "./DisabledButtonTooltip";
import { usePlaygroundExampleEditing } from "./examplesEditing";
import { resolvePlaygroundDatasetId } from "./playgroundURLSearchParamsUtils";
import { useCancelPlaygroundRun } from "./useCancelPlaygroundRun";

const EVALUATORS_NEED_A_DATASET = "Select a dataset to run evaluators";
const EXAMPLES_ARE_BEING_EDITED = "Save or cancel the example edits to run";
/** Instance labels match the A, B, C shown in each instance header. */
function getInstanceLabel(index: number): string {
  return String.fromCharCode("A".charCodeAt(0) + index);
}

/** The first reason a decision instance cannot run, or null when all can. */
function getInvalidDecisionReason(
  instances: readonly Pick<
    PlaygroundNormalizedInstance,
    "model" | "decisionRequest"
  >[]
): string | null {
  for (const [index, instance] of instances.entries()) {
    if (instance.model.modelType !== "DECISION") continue;
    const label = getInstanceLabel(index);
    if (!instance.model.modelName?.trim()) {
      return `Instance ${label}: pick a decision model.`;
    }
    const problem = instance.decisionRequest
      ? getDecisionValidationError(instance.decisionRequest)
      : "no decision request";
    if (problem) return `Instance ${label}: ${problem}`;
  }
  return null;
}

export function PlaygroundRunButton() {
  const modifierKey = useModifierKey();
  const cancelPlaygroundRun = useCancelPlaygroundRun();
  const { runPlaygroundInstances, cancelPlaygroundInstances, instances } =
    usePlaygroundContext((state) => ({
      runPlaygroundInstances: state.runPlaygroundInstances,
      cancelPlaygroundInstances: state.cancelPlaygroundInstances,
      instances: state.instances,
    }));
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );
  const isDatasetMode = usePlaygroundContext(
    (state) => state.datasetId != null
  );
  const hasDecisionInstance = instances.some(
    (instance) => instance.model.modelType === "DECISION"
  );
  // Decision models have no dataset execution path, so a run that would
  // include one over a dataset is refused outright rather than half-run.
  // An invalid decision request is refused the same way, with its first
  // problem as the reason, since the error may sit in a collapsed card.
  const invalidDecisionReason = getInvalidDecisionReason(instances);
  const blockedReason =
    isDatasetMode && hasDecisionInstance
      ? DECISION_DATASET_BLOCKED_REASON
      : invalidDecisionReason;
  const hasInvalidDecision = invalidDecisionReason != null;

  const isEvaluatorKind = usePlaygroundContext(
    (state) => getPlaygroundTaskKind(state.instances) === "evaluator"
  );

  const recordExperiments = usePlaygroundContext(
    (state) => state.recordExperiments
  );

  const [searchParams] = useSearchParams();
  const storeDatasetId = usePlaygroundContext((state) => state.datasetId);

  const hasDataset =
    resolvePlaygroundDatasetId({ searchParams, storeDatasetId }) != null;

  const isEditingExamples = usePlaygroundExampleEditing(
    (session) => session.mode !== "read"
  );

  // Evaluators judge dataset examples; prompts can also run on manual input.
  // Neither runs while the examples are being edited: the server would judge
  // the saved examples, not the ones on screen.
  const canRun =
    (!isEvaluatorKind || hasDataset) &&
    !isEditingExamples &&
    !hasInvalidDecision &&
    blockedReason == null;

  const toggleRunning = useCallback(() => {
    if (isRunning) {
      cancelPlaygroundRun({ instances, cancelPlaygroundInstances });
    } else if (canRun && blockedReason == null) {
      runPlaygroundInstances();
    }
  }, [
    blockedReason,
    isRunning,
    canRun,
    cancelPlaygroundInstances,
    cancelPlaygroundRun,
    runPlaygroundInstances,
    instances,
  ]);
  useHotkeys(
    "mod+enter",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleRunning();
    },
    {
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: true,
    }
  );

  const button = (
    <Button
      data-testid="playground-run-button"
      variant="primary"
      leadingVisual={
        <Icon svg={isRunning ? <Icons.Loading /> : <Icons.PlayCircle />} />
      }
      size="S"
      isDisabled={!isRunning && !canRun}
      onPress={() => {
        toggleRunning();
      }}
      trailingVisual={
        <Keyboard>
          <VisuallyHidden>{modifierKey}</VisuallyHidden>
          <span aria-hidden="true">{modifierKey === "Cmd" ? "⌘" : "Ctrl"}</span>
          <VisuallyHidden>enter</VisuallyHidden>
          <span aria-hidden="true">⏎</span>
        </Keyboard>
      }
    >
      {isRunning ? "Stop" : "Run"}
    </Button>
  );

  if (!canRun && !isRunning) {
    return (
      <DisabledButtonTooltip
        label="Run"
        reason={
          isEditingExamples
            ? EXAMPLES_ARE_BEING_EDITED
            : blockedReason != null
              ? blockedReason
              : hasInvalidDecision
                ? "Complete the decision state, questions, and model to run"
                : EVALUATORS_NEED_A_DATASET
        }
      >
        {button}
      </DisabledButtonTooltip>
    );
  }

  return (
    <TooltipTrigger>
      {button}
      <Tooltip>
        <TooltipArrow />
        {getRunTooltip({ isRunning, hasDataset, recordExperiments })}
      </Tooltip>
    </TooltipTrigger>
  );
}

/** What pressing the button does right now, in a sentence or two. */
function getRunTooltip({
  isRunning,
  hasDataset,
  recordExperiments,
}: {
  isRunning: boolean;
  hasDataset: boolean;
  recordExperiments: boolean;
}): string {
  if (isRunning) {
    return "Stop the running experiments.";
  }

  if (!hasDataset) {
    return "Run every prompt on the inputs.";
  }

  return recordExperiments
    ? "Run every task over the dataset. Recorded."
    : "Run every task over the dataset. Not recorded.";
}
