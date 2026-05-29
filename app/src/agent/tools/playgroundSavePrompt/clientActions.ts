import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { PlaygroundStore } from "@phoenix/store/playground";

import { parseSavePromptInput } from "./parsers";
import { savePlaygroundPrompt } from "./savePlaygroundPrompt";
import type { SavePlaygroundPromptParams } from "./types";

type SavePlaygroundPrompt = (
  params: SavePlaygroundPromptParams
) => ReturnType<typeof savePlaygroundPrompt>;

/**
 * Creates the client action handler for save_prompt.
 * Saves active playground instance state through the prompt GraphQL mutations.
 */
export function createSavePromptClientAction({
  playgroundStore,
  savePrompt = savePlaygroundPrompt,
}: {
  playgroundStore: PlaygroundStore;
  savePrompt?: SavePlaygroundPrompt;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseSavePromptInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid save_prompt input." };
    }

    const result = await savePrompt({ playgroundStore, input: parsed });
    if (!result.ok) {
      return result;
    }
    return {
      ok: true,
      output: JSON.stringify(result.output, null, 2),
    };
  };
}
