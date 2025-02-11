import React, { useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { Button, Icon, Icons } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export function PlaygroundRunButton() {
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
    >
      {isRunning ? "Cancel" : "Run"}
    </Button>
  );
}
