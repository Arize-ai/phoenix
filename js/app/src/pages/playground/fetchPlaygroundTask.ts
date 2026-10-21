import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import type {
  PlaygroundInstance,
  PlaygroundInstanceLoadingSource,
} from "@phoenix/store/playground";

import { fetchPlaygroundDecisionAsInstance } from "./fetchPlaygroundDecision";
import { fetchPlaygroundEvaluatorAsInstance } from "./fetchPlaygroundEvaluator";
import { fetchPlaygroundPromptAsInstance } from "./fetchPlaygroundPrompt";

export type FetchedPlaygroundTask = {
  instance: Omit<PlaygroundInstance, "id">;
  templateFormat: TemplateFormat | null;
};

/** What a source is loaded into. */
export type PlaygroundTaskLoadContext = {
  /**
   * The page's template format, when another task on the page already fixes
   * it; null when the loaded task may set the page's format.
   */
  templateFormat: TemplateFormat | null;
  /** The instance the content lands in, for what the saved source does not set. */
  instance: Pick<PlaygroundInstance, "model" | "llmModel"> | undefined;
};

/**
 * Fetches the saved prompt, decision or evaluator a loading source names, as
 * the instance content to land with `loadInstance`. Null when it cannot be
 * loaded: deleted, built-in, or not a chat prompt. A decision the page's
 * template format cannot express throws, saying so.
 */
export async function fetchPlaygroundTaskInstance(
  source: PlaygroundInstanceLoadingSource,
  context: PlaygroundTaskLoadContext
): Promise<FetchedPlaygroundTask | null> {
  if (source.type === "decision") {
    return fetchPlaygroundDecisionAsInstance({
      decisionId: source.decisionId,
      decisionVersionId: source.decisionVersionId,
      tagName: source.tagName,
      templateFormat: context.templateFormat,
      base: context.instance,
    });
  }

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
