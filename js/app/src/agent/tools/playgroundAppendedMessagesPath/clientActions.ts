import { resolvePlaygroundDatasetId } from "@phoenix/pages/playground/playgroundURLSearchParamsUtils";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { PlaygroundStore } from "@phoenix/store/playground";

import { fetchFirstExampleInput } from "./fetchFirstExampleInput";
import { parseSetAppendedMessagesPathInput } from "./parsers";
import { validateAppendedMessagesPath } from "./validateAppendedMessagesPath";

export function createSetAppendedMessagesPathClientAction({
  playgroundStore,
  getSearchParams,
  getFirstExampleInput = fetchFirstExampleInput,
}: {
  playgroundStore: PlaygroundStore;
  getSearchParams: () => URLSearchParams;
  /** Injectable for tests; the default fetches via Relay. */
  getFirstExampleInput?: (datasetId: string) => Promise<unknown | null>;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseSetAppendedMessagesPathInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid set_appended_messages_path input." };
    }

    // Resolve like the playground page (shared helper), then fall back to the store.
    // This is an imperative read: load_dataset writes the store synchronously but the
    // URL only after a React Router re-render, so the search params here can still be
    // stale right after an accepted load_dataset. Falling back to the store avoids a
    // spurious "no dataset is loaded" result. The fallback lives here, not in the
    // shared helper, because the reactive page must stay URL-primary (its store is
    // never re-synced from the URL, so a store fallback there would keep it wrongly in
    // dataset mode after a back/forward navigation that clears the URL datasetId).
    const storeDatasetId = playgroundStore.getState().datasetId;
    const searchParams = getSearchParams();
    const datasetId =
      resolvePlaygroundDatasetId({ searchParams, storeDatasetId }) ??
      storeDatasetId;
    if (datasetId == null) {
      return {
        ok: false,
        error: "No dataset is loaded; call load_dataset first.",
      };
    }

    const path = parsed.path === "" ? null : parsed.path;

    // Validate a non-empty path against the loaded dataset's first example so
    // a wrong path fails here — one actionable error — instead of failing
    // every run of the next experiment. Validation is best-effort: when the
    // example cannot be fetched (network, empty dataset) the set proceeds.
    if (path != null) {
      let exampleInput: unknown = null;
      try {
        exampleInput = await getFirstExampleInput(datasetId);
      } catch {
        exampleInput = null;
      }
      if (exampleInput != null) {
        const validation = validateAppendedMessagesPath({ exampleInput, path });
        if (!validation.ok) {
          return validation;
        }
      }
    }

    playgroundStore.getState().setAppendedMessagesPath({ path, datasetId });

    return {
      ok: true,
      output: {
        status: "updated",
        datasetId,
        appendedMessagesPath: path,
        message:
          path === null
            ? "Disabled appending dataset messages."
            : `Set appended dataset messages path to "${path}".`,
      },
    };
  };
}
