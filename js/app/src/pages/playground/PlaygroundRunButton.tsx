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

import { DECISION_DATASET_BLOCKED_REASON } from "./constants";
import { getDecisionValidationError } from "./decisionUtils";
import { useCancelPlaygroundRun } from "./useCancelPlaygroundRun";

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
  const blockedReason =
    isDatasetMode && hasDecisionInstance
      ? DECISION_DATASET_BLOCKED_REASON
      : null;
  const hasInvalidDecision = instances.some(
    (instance) =>
      instance.model.modelType === "DECISION" &&
      (!instance.decisionRequest ||
        !!getDecisionValidationError(instance.decisionRequest) ||
        !instance.model.modelName?.trim())
  );

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
