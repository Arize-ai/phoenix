import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { PlaygroundStore } from "@phoenix/store/playground";

import { parseSetPlaygroundRepetitionsInput } from "./parsers";

export function createSetPlaygroundRepetitionsClientAction({
  playgroundStore,
}: {
  playgroundStore: PlaygroundStore;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseSetPlaygroundRepetitionsInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid set_playground_repetitions input.",
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
          "The playground is already running. Wait for the current run to finish or stop it before changing repetitions.",
      };
    }

    const previousRepetitions = state.repetitions;
    state.setRepetitions(parsed.repetitions);

    return {
      ok: true,
      output: JSON.stringify(
        {
          status: "updated",
          previousRepetitions,
          repetitions: parsed.repetitions,
          message: `Set playground repetitions to ${parsed.repetitions}.`,
        },
        null,
        2
      ),
    };
  };
}
