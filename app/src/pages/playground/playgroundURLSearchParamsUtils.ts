/**
 * A single prompt selection parsed from URL search params.
 */
export type PromptParam = {
  promptId: string;
  promptVersionId: string | null;
  tagName: string | null;
};

/**
 * Parses prompt-related search params from a URLSearchParams instance.
 * The three param arrays (`promptId`, `promptVersionId`, `promptTagName`)
 * are zipped by position into {@link PromptParam} tuples.
 *
 * Returns an empty array if no `promptId` params are present.
 */
export function parsePromptParams(
  searchParams: URLSearchParams
): PromptParam[] {
  const promptIds = searchParams.getAll("promptId");
  if (promptIds.length === 0) {
    return [];
  }

  const promptVersionIds = searchParams.getAll("promptVersionId");
  const promptTagNames = searchParams.getAll("promptTagName");

  return promptIds.map((promptId, index) => ({
    promptId,
    promptVersionId: promptVersionIds[index] || null,
    tagName: promptTagNames[index] || null,
  }));
}

/**
 * Sets prompt-related search params on a URLSearchParams instance,
 * replacing any existing prompt-related params.
 *
 * Returns `true` if the params actually changed, `false` if they were
 * already in sync.
 */
export function setPromptParams({
  searchParams,
  prompts,
}: {
  searchParams: URLSearchParams;
  prompts: PromptParam[];
}): boolean {
  const currentIds = searchParams.getAll("promptId");
  const currentVersionIds = searchParams.getAll("promptVersionId");
  const currentTagNames = searchParams.getAll("promptTagName");

  const newIds = prompts.map((prompt) => prompt.promptId);
  const newVersionIds = prompts.map((prompt) => prompt.promptVersionId ?? "");
  const newTagNames = prompts.map((prompt) => prompt.tagName ?? "");

  const idsMatch =
    currentIds.length === newIds.length &&
    currentIds.every((id, index) => id === newIds[index]);
  const versionIdsMatch =
    currentVersionIds.length === newVersionIds.length &&
    currentVersionIds.every((id, index) => id === newVersionIds[index]);
  const tagNamesMatch =
    currentTagNames.length === newTagNames.length &&
    currentTagNames.every((name, index) => name === newTagNames[index]);

  if (idsMatch && versionIdsMatch && tagNamesMatch) {
    return false;
  }

  searchParams.delete("promptId");
  searchParams.delete("promptVersionId");
  searchParams.delete("promptTagName");

  for (const prompt of prompts) {
    searchParams.append("promptId", prompt.promptId);
    searchParams.append("promptVersionId", prompt.promptVersionId ?? "");
    searchParams.append("promptTagName", prompt.tagName ?? "");
  }

  return true;
}

/**
 * Resolves the active playground datasetId.
 *
 * In experiment mode (an `experimentId` param is present) the playground store is
 * the source of truth for the datasetId — pass the store copy as `storeDatasetId`.
 * Outside experiment mode the URL `datasetId` param is authoritative; the store
 * copy is null for a URL-deep-linked dataset, so reading it instead would silently
 * no-op.
 *
 * This is intentionally URL-primary (not URL-with-store-fallback): the page store
 * is created once and is never re-synced from the URL, so on a navigation that
 * clears the URL `datasetId` without going through `setDatasetId` (e.g. browser
 * back/forward), a store fallback would keep the page wrongly in dataset mode.
 * An imperative caller that needs the synchronously-fresh store value right after a
 * `setDatasetId` (e.g. the `set_appended_messages_path` agent tool, which can run
 * before the URL catches up) should apply its own `?? storeDatasetId` fallback at
 * the call site rather than baking it in here.
 *
 * This is the single source of truth for the resolution — both the playground page
 * and the `set_appended_messages_path` agent tool depend on it staying in sync.
 */
export function resolvePlaygroundDatasetId({
  searchParams,
  storeDatasetId,
}: {
  searchParams: URLSearchParams;
  storeDatasetId: string | null;
}): string | null {
  const experimentId = searchParams.get("experimentId");
  return experimentId ? storeDatasetId : searchParams.get("datasetId");
}
