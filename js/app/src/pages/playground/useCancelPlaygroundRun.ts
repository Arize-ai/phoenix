import { useCallback } from "react";
import { graphql, useMutation } from "react-relay";

import { cancelPlaygroundRun } from "@phoenix/agent/tools/playgroundRun";
import type { PlaygroundNormalizedInstance } from "@phoenix/store/playground";

import type { useCancelPlaygroundRunDismissMutation } from "./__generated__/useCancelPlaygroundRunDismissMutation.graphql";
import type { useCancelPlaygroundRunStopMutation } from "./__generated__/useCancelPlaygroundRunStopMutation.graphql";

export function useCancelPlaygroundRun() {
  const [stopExperiment] =
    useMutation<useCancelPlaygroundRunStopMutation>(graphql`
      mutation useCancelPlaygroundRunStopMutation($experimentId: ID!) {
        stopExperiment(experimentId: $experimentId) {
          job {
            id
            status
          }
        }
      }
    `);

  const [dismissExperiment] =
    useMutation<useCancelPlaygroundRunDismissMutation>(graphql`
      mutation useCancelPlaygroundRunDismissMutation($experimentId: ID!) {
        dismissExperiment(experimentId: $experimentId) {
          experiment {
            id
          }
        }
      }
    `);

  return useCallback(
    ({
      instances,
      cancelPlaygroundInstances,
    }: {
      instances: PlaygroundNormalizedInstance[];
      cancelPlaygroundInstances: () => void;
    }) =>
      cancelPlaygroundRun({
        instances,
        cancelPlaygroundInstances,
        stopExperiment: ({ experimentId }) =>
          stopExperiment({ variables: { experimentId } }),
        dismissExperiment: ({ experimentId }) =>
          dismissExperiment({ variables: { experimentId } }),
      }),
    [dismissExperiment, stopExperiment]
  );
}
