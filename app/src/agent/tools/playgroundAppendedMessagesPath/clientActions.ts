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

    // Resolve like PlaygroundContent: outside experiment mode the URL is the source
    // of truth; store.datasetId is a secondary copy that is null for URL-deep-linked datasets.
    const searchParams = getSearchParams();
    const experimentId = searchParams.get("experimentId");
    const datasetId = experimentId
      ? playgroundStore.getState().datasetId
      : searchParams.get("datasetId");
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
