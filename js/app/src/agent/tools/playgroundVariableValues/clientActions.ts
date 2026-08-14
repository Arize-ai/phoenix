import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { PlaygroundStore } from "@phoenix/store/playground";

import { parseSetVariableValuesInput } from "./parsers";

/**
 * Creates the client action handler for set_variable_values.
 * Stores manual playground variable values in the mounted playground store.
 */
export function createSetVariableValuesClientAction({
  playgroundStore,
}: {
  playgroundStore: PlaygroundStore;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseSetVariableValuesInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid set_variable_values input." };
    }

    playgroundStore.getState().setVariableValues(parsed.values);

    const variableKeys = parsed.values.map(({ key }) => key);

    return {
      ok: true,
      output: JSON.stringify(
        {
          status: "updated",
          variables: variableKeys,
          message: `Set ${variableKeys.length} playground variable value${variableKeys.length === 1 ? "" : "s"}.`,
        },
        null,
        2
      ),
    };
  };
}
