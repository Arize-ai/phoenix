import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import { readExperimentResults } from "./readExperimentResults";
import type { ReadExperimentResultsInput } from "./schemas";

/**
 * Creates the client action handler for `playground.experiment.readResults`.
 * A pure API read (Relay fetch) with no playground-store dependency; it
 * registers on the playground because that is where the run → read → iterate
 * loop lives.
 */
export function createReadExperimentResultsClientAction() {
  return async (
    input: ReadExperimentResultsInput
  ): Promise<AgentClientActionResult> => {
    try {
      const results = await readExperimentResults(input);
      return { ok: true, output: results };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
}
