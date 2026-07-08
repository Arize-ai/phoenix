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

  const toggleRunning = useCallback(() => {
    if (isRunning) {
      cancelPlaygroundRun({ instances, cancelPlaygroundInstances });
    } else {
      runPlaygroundInstances();
    }
  }, [
    isRunning,
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
  return (
    <Button
      data-testid="playground-run-button"
      variant="primary"
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
}
