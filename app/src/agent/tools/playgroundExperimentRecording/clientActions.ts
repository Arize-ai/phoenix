import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { PlaygroundStore } from "@phoenix/store/playground";

import { parseSetPlaygroundExperimentRecordingInput } from "./parsers";

function getExperimentRecordingMode(recordExperiments: boolean) {
  return recordExperiments ? "persistent" : "ephemeral";
}

/**
 * Creates the client action handler for set_playground_experiment_recording.
 * Updates the mounted playground's future dataset-backed run persistence mode.
 */
export function createSetPlaygroundExperimentRecordingClientAction({
  playgroundStore,
}: {
  playgroundStore: PlaygroundStore;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseSetPlaygroundExperimentRecordingInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid set_playground_experiment_recording input.",
      };
    }

    const state = playgroundStore.getState();
    const isRunning = state.instances.some(
      (instance) => instance.activeRunId != null
    );
    if (isRunning) {
      return {
        ok: false,
        error:
          "The playground is already running. Wait for the current run to finish or stop it before changing experiment recording.",
      };
    }

    const previousRecordExperiments = state.recordExperiments;
    state.setRecordExperiments(parsed.recordExperiments);
    const mode = getExperimentRecordingMode(parsed.recordExperiments);

    return {
      ok: true,
      output: JSON.stringify(
        {
          status: "updated",
          previousRecordExperiments,
          recordExperiments: parsed.recordExperiments,
          mode,
          message: parsed.recordExperiments
            ? "Future dataset-backed playground runs will be recorded as experiments."
            : "Future dataset-backed playground runs will be temporary and unrecorded.",
        },
        null,
        2
      ),
    };
  };
}
