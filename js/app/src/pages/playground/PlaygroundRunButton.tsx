import { useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useSearchParams } from "react-router";

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
import { resolvePlaygroundDatasetId } from "./playgroundURLSearchParamsUtils";
import { useCancelPlaygroundRun } from "./useCancelPlaygroundRun";

const EVALUATORS_NEED_A_DATASET = "Select a dataset to run evaluators";

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
  const [searchParams] = useSearchParams();
  const storeDatasetId = usePlaygroundContext((state) => state.datasetId);
  const hasDataset =
    resolvePlaygroundDatasetId({ searchParams, storeDatasetId }) != null;
  // Evaluators judge dataset examples; prompts can also run on manual input.
  const canRun = !isEvaluatorKind || hasDataset;

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
    <DisabledButtonTooltip label="Run" reason={EVALUATORS_NEED_A_DATASET}>
      {button}
    </DisabledButtonTooltip>
  );
}
