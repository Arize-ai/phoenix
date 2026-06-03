import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { PlaygroundStore } from "@phoenix/store/playground";

import { parseSetTemplateVariablesPathInput } from "./parsers";

export function createSetTemplateVariablesPathClientAction({
  playgroundStore,
  getSearchParams,
}: {
  playgroundStore: PlaygroundStore;
  getSearchParams: () => URLSearchParams;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseSetTemplateVariablesPathInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid set_template_variables_path input." };
    }

    // Resolve the active datasetId the way PlaygroundContent does: in non-experiment
    // mode the store's datasetId copy is null for a URL-deep-linked dataset.
    const searchParams = getSearchParams();
    const experimentId = searchParams.get("experimentId");
    const datasetId = experimentId
      ? playgroundStore.getState().datasetId
      : searchParams.get("datasetId");

    if (!datasetId) {
      return {
        ok: false,
        error:
          "No dataset is loaded in the playground. Load a dataset first, then set the template variables path.",
      };
    }

    const templateVariablesPath = parsed.path || null;
    playgroundStore
      .getState()
      .setTemplateVariablesPath({ templateVariablesPath, datasetId });

    return {
      ok: true,
      output: JSON.stringify(
        {
          status: "updated",
          templateVariablesPath,
          message: templateVariablesPath
            ? `Set template variables path to "${templateVariablesPath}".`
            : "Set template variables path to the example root.",
        },
        null,
        2
      ),
    };
  };
}
