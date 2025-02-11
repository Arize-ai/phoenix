import React from "react";

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
        if (isRunning) {
          cancelPlaygroundInstances();
        } else {
          runPlaygroundInstances();
        }
      }}
    >
      {isRunning ? "Cancel" : "Run"}
    </Button>
  );
}
