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
