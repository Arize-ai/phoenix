import { useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Icon,
  Icons,
  Keyboard,
  VisuallyHidden,
} from "@phoenix/components";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useModifierKey } from "@phoenix/hooks/useModifierKey";

import { PlaygroundRunButtonStopMutation } from "./__generated__/PlaygroundRunButtonStopMutation.graphql";

export function PlaygroundRunButton() {
  const modifierKey = useModifierKey();
  const backgroundExperimentsEnabled = useFeatureFlag("backgroundExperiments");
  const { runPlaygroundInstances, cancelPlaygroundInstances, instances } =
    usePlaygroundContext((state) => ({
      runPlaygroundInstances: state.runPlaygroundInstances,
      cancelPlaygroundInstances: state.cancelPlaygroundInstances,
      instances: state.instances,
    }));
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );

  const [stopExperiment] = useMutation<PlaygroundRunButtonStopMutation>(graphql`
    mutation PlaygroundRunButtonStopMutation($experimentId: ID!) {
      stopExperiment(experimentId: $experimentId) {
        job {
          id
          isActive
        }
      }
    }
  `);

  const toggleRunning = useCallback(() => {
    if (isRunning) {
      // When background experiments are enabled, stop the experiments on the backend
      // When disabled, just disconnect from the subscription
      if (backgroundExperimentsEnabled) {
        // Stop all running experiments on the backend
        for (const instance of instances) {
          if (instance.experimentId) {
            stopExperiment({
              variables: { experimentId: instance.experimentId },
            });
          }
        }
      }
      // Update local state (disconnect from subscription)
      cancelPlaygroundInstances();
    } else {
      runPlaygroundInstances();
    }
  }, [
    isRunning,
    backgroundExperimentsEnabled,
    cancelPlaygroundInstances,
    runPlaygroundInstances,
    instances,
    stopExperiment,
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
      {isRunning ? "Stop" : "Run"}
    </Button>
  );
}
