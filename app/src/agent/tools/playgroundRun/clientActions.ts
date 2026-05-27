import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { PlaygroundStore } from "@phoenix/store/playground";

import { getInstanceLabel } from "../playgroundPrompt";
import { parseRunPlaygroundInput } from "./parsers";

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
