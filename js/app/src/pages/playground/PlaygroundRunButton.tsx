import { useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import {
  Button,
  Icon,
  Icons,
  Keyboard,
  VisuallyHidden,
} from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useModifierKey } from "@phoenix/hooks/useModifierKey";
import { getPlaygroundTaskKind } from "@phoenix/store/playground";

import { DisabledButtonTooltip } from "./DisabledButtonTooltip";
import { useCancelPlaygroundRun } from "./useCancelPlaygroundRun";

const EVALUATOR_RUNS_PENDING =
  "Evaluator runs land with the experiment API change";

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
  const isEvaluatorKind = usePlaygroundContext(
    (state) => getPlaygroundTaskKind(state.instances) === "evaluator"
  );
  const canRun = !isEvaluatorKind;

  const toggleRunning = useCallback(() => {
    if (isRunning) {
      cancelPlaygroundRun({ instances, cancelPlaygroundInstances });
    } else if (canRun) {
      runPlaygroundInstances();
    }
  }, [
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
  return canRun || isRunning ? (
    button
  ) : (
    <DisabledButtonTooltip label="Run" reason={EVALUATOR_RUNS_PENDING}>
      {button}
    </DisabledButtonTooltip>
  );
}
