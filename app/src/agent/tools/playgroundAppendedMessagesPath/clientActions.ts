import { resolvePlaygroundDatasetId } from "@phoenix/pages/playground/playgroundURLSearchParamsUtils";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { PlaygroundStore } from "@phoenix/store/playground";

import { parseSetAppendedMessagesPathInput } from "./parsers";

export function createSetAppendedMessagesPathClientAction({
  playgroundStore,
  getSearchParams,
}: {
  playgroundStore: PlaygroundStore;
  getSearchParams: () => URLSearchParams;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseSetAppendedMessagesPathInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid set_appended_messages_path input." };
    }

    // Resolve like the playground page (shared helper). Outside experiment mode the
    // URL is authoritative, but it falls back to the store so a call right after an
    // accepted load_dataset still resolves: load_dataset writes the store
    // synchronously while the URL only updates after a React Router re-render, so the
    // search params read here can still be stale.
    const datasetId = resolvePlaygroundDatasetId({
      searchParams: getSearchParams(),
      storeDatasetId: playgroundStore.getState().datasetId,
    });
    if (datasetId == null) {
      return {
        ok: false,
        error: "No dataset is loaded; call load_dataset first.",
      };
    }

    const path = parsed.path === "" ? null : parsed.path;
    playgroundStore.getState().setAppendedMessagesPath({ path, datasetId });

    return {
      ok: true,
      output: JSON.stringify(
        {
          status: "updated",
          datasetId,
          appendedMessagesPath: path,
          message:
            path === null
              ? "Disabled appending dataset messages."
              : `Set appended dataset messages path to "${path}".`,
        },
        null,
        2
      ),
    };
  };
}
