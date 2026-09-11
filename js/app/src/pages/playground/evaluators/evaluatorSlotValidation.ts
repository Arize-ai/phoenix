import type { CodeEvaluatorLanguage } from "@phoenix/types";

/** Validate executable code against the currently available sandbox configurations. */
export function getCodeSlotValidationError({
  sourceCode,
  language,
  sandboxConfigId,
  sandboxConfigs,
}: {
  sourceCode: string;
  language: CodeEvaluatorLanguage;
  sandboxConfigId: string | null;
  sandboxConfigs: ReadonlyArray<{
    id: string;
    language: CodeEvaluatorLanguage;
  }>;
}): string | null {
  if (!sourceCode.trim()) return "Enter evaluator code before running.";

  if (!sandboxConfigId)
    return "Select a sandbox before running this code evaluator.";

  const sandbox = sandboxConfigs.find(
    (config) => config.id === sandboxConfigId
  );

  if (!sandbox)
    return "The selected sandbox is unavailable. Select another sandbox.";

  if (sandbox.language !== language)
    return "Select a sandbox that supports the evaluator language.";

  return null;
}

/**
 * The sandbox a code slot should run in: the preferred one if it still fits the
 * language, otherwise the first compatible one, so a fresh slot is runnable
 * without a manual pick.
 */
export function getDefaultSandboxConfigId({
  sandboxConfigs,
  language,
  preferredId = null,
}: {
  sandboxConfigs: ReadonlyArray<{
    id: string;
    language: CodeEvaluatorLanguage;
  }>;
  language: CodeEvaluatorLanguage;
  preferredId?: string | null;
}): string | null {
  const compatible = sandboxConfigs.filter(
    (config) => config.language === language
  );

  if (preferredId && compatible.some((config) => config.id === preferredId))
    return preferredId;

  return compatible[0]?.id ?? null;
}

/** Keep a source's name visible while its search results are filtered or unloaded. */
export function getSlotSourceLabel({
  selection,
  sourceName,
  options,
}: {
  selection: string;
  sourceName: string;
  options: ReadonlyArray<{ id: string; name: string }>;
}): string {
  if (selection === "new-llm") return "New LLM evaluator";

  if (selection === "new-code") return "New code evaluator";

  return options.find((option) => option.id === selection)?.name ?? sourceName;
}
