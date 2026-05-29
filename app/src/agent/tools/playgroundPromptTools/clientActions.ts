import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { PlaygroundStore } from "@phoenix/store/playground";

import {
  parseReadPromptToolsInput,
  parseWritePromptToolsInput,
} from "./parsers";
import {
  applyWritePromptTools,
  getPromptToolsSnapshot,
} from "./promptToolsStore";

/** Returns the current prompt tool list snapshot as JSON. */
export function createReadPromptToolsClientAction({
  playgroundStore,
}: {
  playgroundStore: PlaygroundStore;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseReadPromptToolsInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid read_prompt_tools input." };
    }
    const snapshot = getPromptToolsSnapshot({
      playgroundStore,
      instanceId: parsed.instanceId,
    });
    if (!snapshot.ok) return snapshot;
    return { ok: true, output: JSON.stringify(snapshot.output, null, 2) };
  };
}

/**
 * Upserts a batch of function tools on a playground prompt instance. Verifies
 * the input's `expectedRevision` against the current snapshot before mutating
 * and applies the batch atomically (all-or-nothing).
 */
export function createWritePromptToolsClientAction({
  playgroundStore,
}: {
  playgroundStore: PlaygroundStore;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseWritePromptToolsInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid write_prompt_tools input." };
    }
    const result = applyWritePromptTools({ playgroundStore, input: parsed });
    if (!result.ok) return result;
    return { ok: true, output: JSON.stringify(result.output, null, 2) };
  };
}
