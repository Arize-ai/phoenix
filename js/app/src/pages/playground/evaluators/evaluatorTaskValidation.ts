import { getEvaluatorOutputConfigValidationErrors } from "@phoenix/components/evaluators/utils";
import type { PlaygroundEvaluatorTask } from "@phoenix/store/playground";
import type { CodeEvaluatorLanguage } from "@phoenix/types";

/** Validate executable code against the currently available sandbox configurations. */
export function getCodeEvaluatorValidationError({
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
 * The sandbox a code evaluator should run in: the preferred one if it still
 * fits the language, otherwise the first compatible one, so a fresh draft is
 * runnable without a manual pick.
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

/**
 * Why the task cannot run or be saved yet, or null. Output configs are
 * checked for every kind; code needs source and a sandbox; the judge prompt
 * is checked by building its payload, which `buildPreview` does.
 */
export function getEvaluatorTaskValidationError({
  evaluator,
  sandboxConfigs,
  buildPreview,
}: {
  evaluator: Pick<PlaygroundEvaluatorTask, "kind" | "outputConfigs" | "code">;
  sandboxConfigs: ReadonlyArray<{
    id: string;
    language: CodeEvaluatorLanguage;
  }>;
  buildPreview: () => unknown;
}): string | null {
  const outputErrors = getEvaluatorOutputConfigValidationErrors({
    kind: evaluator.kind,
    configs: evaluator.outputConfigs,
  }).join("\n");
  if (outputErrors) return outputErrors;

  if (!evaluator.outputConfigs.length) return "Choose an output to review.";

  if (evaluator.kind === "CODE") {
    return evaluator.code
      ? getCodeEvaluatorValidationError({ ...evaluator.code, sandboxConfigs })
      : "Enter evaluator code before running.";
  }

  try {
    buildPreview();
    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Complete the evaluator configuration.";
  }
}
