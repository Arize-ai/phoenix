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
export function PlaygroundRunButton() {
  const modifierKey = useModifierKey();
  const runPlaygroundInstances = usePlaygroundContext(
    (state) => state.runPlaygroundInstances
  );
  const cancelPlaygroundInstances = usePlaygroundContext(
    (state) => state.cancelPlaygroundInstances
  );
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );
  const toggleRunning = useCallback(() => {
    if (isRunning) {
      cancelPlaygroundInstances();
    } else {
      runPlaygroundInstances();
    }
  }, [isRunning, cancelPlaygroundInstances, runPlaygroundInstances]);
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
      variant="primary"
      leadingVisual={
        <Icon
          svg={
            isRunning ? <Icons.LoadingOutline /> : <Icons.PlayCircleOutline />
          }
        />
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
      {isRunning ? "Cancel" : "Run"}
    </Button>
  );
}
