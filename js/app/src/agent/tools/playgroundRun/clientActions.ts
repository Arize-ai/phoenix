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

function hasActiveRun(instances: PlaygroundNormalizedInstance[]): boolean {
  return instances.some((instance) => instance.activeRunId != null);
}

/**
 * Resolves once no instance has an active run: every instance finished
 * (`markPlaygroundInstanceComplete`) or the run was cancelled
 * (`cancelPlaygroundInstances`).
 */
function waitForPlaygroundRunEnd(
  playgroundStore: PlaygroundStore
): Promise<void> {
  return new Promise((resolve) => {
    if (!hasActiveRun(playgroundStore.getState().instances)) {
      resolve();
      return;
    }
    const unsubscribe = playgroundStore.subscribe((state) => {
      if (!hasActiveRun(state.instances)) {
        unsubscribe();
        resolve();
      }
    });
  });
}

/**
 * Creates the client action handler for `playground.run`.
 * Starts the same run the playground Run button would start, then resolves
 * only when the run ends (every instance finished, or the run was
 * cancelled) — so a script can read output right after awaiting it. The
 * operation is marked `longRunning`, which pauses the script's wall-clock
 * budget while this promise is in flight.
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
    await waitForPlaygroundRunEnd(playgroundStore);

    const experimentIds = playgroundStore
      .getState()
      .instances.map((instance) => instance.experiment?.id)
      .filter((experimentId): experimentId is string => Boolean(experimentId));

    return {
      ok: true,
      output: {
        status: "completed",
        instances,
        ...(experimentIds.length > 0 ? { experimentIds } : {}),
        message:
          "Playground run finished. Read the results with playground.run.readOutput.",
      },
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
      output: {
        status: "cancelled",
        instances: result.instances,
        experimentIds: result.experimentIds,
        message: "Playground run cancelled.",
      },
    };
  };
}
