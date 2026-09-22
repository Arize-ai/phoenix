import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import type {
  PlaygroundInstance,
  PlaygroundInstanceLoadingSource,
} from "@phoenix/store/playground";

import { fetchPlaygroundEvaluatorAsInstance } from "./fetchPlaygroundEvaluator";
import { fetchPlaygroundPromptAsInstance } from "./fetchPlaygroundPrompt";

export type FetchedPlaygroundTask = {
  instance: Omit<PlaygroundInstance, "id">;
  templateFormat: TemplateFormat | null;
};

/**
 * Fetches the saved prompt or evaluator a loading source names, as the
 * instance content to land with `loadInstance`. Null when it cannot be
 * loaded: deleted, built-in, or not a chat prompt.
 */
export async function fetchPlaygroundTaskInstance(
  source: PlaygroundInstanceLoadingSource
): Promise<FetchedPlaygroundTask | null> {
  if (source.type !== "prompt") {
    return fetchPlaygroundEvaluatorAsInstance(source);
  }

  const loaded = await fetchPlaygroundPromptAsInstance({
    promptId: source.promptId,
    promptVersionId: source.promptVersionId,
    tagName: source.tagName,
  });

  return loaded
    ? {
        instance: loaded.instance,
        // SAFETY: Relay widens the schema's TemplateFormat enum with
        // "%future added value"; a saved prompt version always carries a
        // known format.
        templateFormat: loaded.promptVersion.templateFormat as TemplateFormat,
      }
    : null;
}
