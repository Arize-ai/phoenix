import React from "react";

import { Button, Icon, Icons } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export function PlaygroundRunButton() {
  const runPlaygroundInstances = usePlaygroundContext(
    (state) => state.runPlaygroundInstances
  );
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.isRunning)
  );
  return (
    <Button
      variant="primary"
      disabled={isRunning}
      icon={<Icon svg={<Icons.PlayCircleOutline />} />}
      loading={isRunning}
      size="compact"
      onClick={() => {
        runPlaygroundInstances();
      }}
    >
      {isRunning ? "Running..." : "Run"}
    </Button>
  );
}
