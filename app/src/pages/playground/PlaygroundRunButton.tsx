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
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useModifierKey } from "@phoenix/hooks/useModifierKey";

import type { PlaygroundRunButtonDismissMutation } from "./__generated__/PlaygroundRunButtonDismissMutation.graphql";
import type { PlaygroundRunButtonStopMutation } from "./__generated__/PlaygroundRunButtonStopMutation.graphql";

export function PlaygroundRunButton() {
  const modifierKey = useModifierKey();
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
          status
        }
      }
    }
  `);

  const [dismissExperiment] =
    useMutation<PlaygroundRunButtonDismissMutation>(graphql`
      mutation PlaygroundRunButtonDismissMutation($experimentId: ID!) {
        dismissExperiment(experimentId: $experimentId) {
          experiment {
            id
          }
        }
      }
    `);

  const toggleRunning = useCallback(() => {
    if (isRunning) {
      for (const instance of instances) {
        if (instance.experiment) {
          stopExperiment({
            variables: { experimentId: instance.experiment.id },
          });
          dismissExperiment({
            variables: { experimentId: instance.experiment.id },
          });
        }
      }
      cancelPlaygroundInstances();
    } else {
      runPlaygroundInstances();
    }
  }, [
    isRunning,
    cancelPlaygroundInstances,
    runPlaygroundInstances,
    instances,
    stopExperiment,
    dismissExperiment,
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
