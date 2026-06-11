import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { ExperimentScaffold } from "@phoenix/store/playground";
import type { PlaygroundStore } from "@phoenix/store/playground";

import { parseSetPlaygroundExperimentRecordingInput } from "./parsers";
import type { SetPlaygroundExperimentRecordingInput } from "./types";

function getExperimentRecordingMode(recordExperiments: boolean) {
  return recordExperiments ? "persistent" : "ephemeral";
}

function buildExperimentScaffold(
  input: SetPlaygroundExperimentRecordingInput
): ExperimentScaffold | null {
  const scaffold: ExperimentScaffold = {};
  if (input.experimentName !== undefined) {
    scaffold.name = input.experimentName;
  }
  if (input.experimentDescription !== undefined) {
    scaffold.description = input.experimentDescription;
  }
  if (input.experimentMetadata !== undefined) {
    scaffold.metadata = input.experimentMetadata;
  }
  return Object.keys(scaffold).length > 0 ? scaffold : null;
}

/**
 * Creates the client action handler for set_playground_experiment_recording.
 * Updates the mounted playground's future dataset-backed run persistence mode
 * and stages the name/description/metadata for the next run's experiments.
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
          "The playground is already running. Wait for the current run to finish, or ask to stop it with cancel_playground_run before changing experiment recording.",
      };
    }

    const previousRecordExperiments = state.recordExperiments;
    state.setRecordExperiments(parsed.recordExperiments);
    const mode = getExperimentRecordingMode(parsed.recordExperiments);

    const scaffold = buildExperimentScaffold(parsed);
    if (scaffold != null) {
      state.setNextExperimentScaffold(scaffold);
    }

    return {
      ok: true,
      output: JSON.stringify(
        {
          status: "updated",
          previousRecordExperiments,
          recordExperiments: parsed.recordExperiments,
          mode,
          nextExperimentScaffold: scaffold,
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
