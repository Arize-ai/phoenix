import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type {
  PlaygroundNormalizedInstance,
  PlaygroundStore,
} from "@phoenix/store/playground";

import { getInstanceLabel } from "../playgroundPrompt";
import {
  parseCancelPlaygroundRunInput,
  parseRunPlaygroundInput,
} from "./parsers";

type PlaygroundRunExperimentAction = (params: { experimentId: string }) => void;

type CancelPlaygroundRunParams = {
  instances: PlaygroundNormalizedInstance[];
  cancelPlaygroundInstances: () => void;
  stopExperiment?: PlaygroundRunExperimentAction;
  dismissExperiment?: PlaygroundRunExperimentAction;
};

type CancelPlaygroundRunResult = {
  instances: { instanceId: number; label: string }[];
  experimentIds: string[];
};

type CancelPlaygroundRun = (
  params: CancelPlaygroundRunParams
) => CancelPlaygroundRunResult;

export function cancelPlaygroundRun({
  instances,
  cancelPlaygroundInstances,
  stopExperiment,
  dismissExperiment,
}: CancelPlaygroundRunParams): CancelPlaygroundRunResult {
  const activeInstances = instances
    .map((instance, index) => ({ instance, index }))
    .filter(({ instance }) => instance.activeRunId != null);
  const experimentIds = instances
    .map((instance) => instance.experiment?.id)
    .filter((experimentId): experimentId is string => Boolean(experimentId));

  for (const experimentId of experimentIds) {
    stopExperiment?.({ experimentId });
    dismissExperiment?.({ experimentId });
  }
  cancelPlaygroundInstances();

  return {
    instances: activeInstances.map(({ instance, index }) => ({
      instanceId: instance.id,
      label: getInstanceLabel(index),
    })),
    experimentIds,
  };
}

/**
 * Creates the client action handler for run_playground.
 * Starts the same run the playground Run button would start.
 */
export function createRunPlaygroundClientAction({
  playgroundStore,
}: {
  playgroundStore: PlaygroundStore;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseRunPlaygroundInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid run_playground input." };
    }

    const state = playgroundStore.getState();
    const hasInstances = state.instances.length > 0;
    if (!hasInstances) {
      return {
        ok: false,
        error: "The playground has no prompt instances to run.",
      };
    }

    const isRunning = state.instances.some(
      (instance) => instance.activeRunId != null
    );
    if (isRunning) {
      return {
        ok: false,
        error:
          "The playground is already running. Wait for the current run to finish or stop it before starting another run.",
      };
    }

    const instances = state.instances.map((instance, index) => ({
      instanceId: instance.id,
      label: getInstanceLabel(index),
    }));
    state.runPlaygroundInstances();

    return {
      ok: true,
      output: JSON.stringify(
        {
          status: "started",
          instances,
          message: "Playground run started.",
        },
        null,
        2
      ),
    };
  };
}

export function createCancelPlaygroundRunClientAction({
  playgroundStore,
  cancelRun = cancelPlaygroundRun,
}: {
  playgroundStore: PlaygroundStore;
  cancelRun?: CancelPlaygroundRun;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseCancelPlaygroundRunInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid cancel_playground_run input." };
    }

    const state = playgroundStore.getState();
    const hasInstances = state.instances.length > 0;
    if (!hasInstances) {
      return {
        ok: false,
        error: "The playground has no prompt instances to cancel.",
      };
    }

    const isRunning = state.instances.some(
      (instance) => instance.activeRunId != null
    );
    if (!isRunning) {
      return {
        ok: false,
        error: "The playground is not running; there is no run to cancel.",
      };
    }

    const result = cancelRun({
      instances: state.instances,
      cancelPlaygroundInstances: state.cancelPlaygroundInstances,
    });

    return {
      ok: true,
      output: JSON.stringify(
        {
          status: "cancelled",
          instances: result.instances,
          experimentIds: result.experimentIds,
          message: "Playground run cancelled.",
        },
        null,
        2
      ),
    };
  };
}
