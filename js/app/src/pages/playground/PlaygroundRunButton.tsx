import { useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import {
  Button,
  Icon,
  Icons,
  Keyboard,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
  VisuallyHidden,
} from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useModifierKey } from "@phoenix/hooks/useModifierKey";
import type { PlaygroundNormalizedInstance } from "@phoenix/store/playground/types";

import { DECISION_DATASET_BLOCKED_REASON } from "./constants";
import { getDecisionValidationError } from "./decisionUtils";
import { useCancelPlaygroundRun } from "./useCancelPlaygroundRun";

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

  const toggleRunning = useCallback(() => {
    if (isRunning) {
      cancelPlaygroundRun({ instances, cancelPlaygroundInstances });
    } else if (!hasInvalidDecision && blockedReason == null) {
      runPlaygroundInstances();
    }
  }, [
    blockedReason,
    isRunning,
    cancelPlaygroundInstances,
    cancelPlaygroundRun,
    runPlaygroundInstances,
    instances,
    hasInvalidDecision,
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
      isDisabled={!isRunning && (hasInvalidDecision || blockedReason != null)}
      leadingVisual={
        <Icon svg={isRunning ? <Icons.Loading /> : <Icons.PlayCircle />} />
      }
      size="S"
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
  if (blockedReason == null) {
    return button;
  }
  return (
    <TooltipTrigger delay={0}>
      <TriggerWrap>{button}</TriggerWrap>
      <Tooltip>
        <TooltipArrow />
        {blockedReason}
      </Tooltip>
    </TooltipTrigger>
  );
}
