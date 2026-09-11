import type {
  CodeEvaluatorActionResult,
  CodeEvaluatorDraftSnapshot,
  EditCodeEvaluatorDraftOperation,
} from "./types";

export type SandboxConfigIndex = Record<
  string,
  { language: "PYTHON" | "TYPESCRIPT" } | undefined
>;

function getMissingCreateSandboxConfigError(
  language: CodeEvaluatorDraftSnapshot["language"]
): string {
  return `Creating a code evaluator requires a non-null sandboxConfigId. Choose an available sandbox config whose language is ${language}.`;
}

export function applyDraftOperations({
  snapshot,
  operations,
  sandboxConfigs,
}: {
  snapshot: CodeEvaluatorDraftSnapshot;
  operations: EditCodeEvaluatorDraftOperation[];
  sandboxConfigs: SandboxConfigIndex;
}): CodeEvaluatorActionResult<CodeEvaluatorDraftSnapshot> {
  let next = snapshot;
  for (const operation of operations) {
    const result = applyDraftOperation({
      snapshot: next,
      operation,
      sandboxConfigs,
    });
    if (!result.ok) return result;
    next = result.output;
  }
  if (next.mode === "create" && next.sandboxConfigId == null) {
    return {
      ok: false,
      error: getMissingCreateSandboxConfigError(next.language),
    };
  }
  return { ok: true, output: next };
}

function applyDraftOperation({
  snapshot,
  operation,
  sandboxConfigs,
}: {
  snapshot: CodeEvaluatorDraftSnapshot;
  operation: EditCodeEvaluatorDraftOperation;
  sandboxConfigs: SandboxConfigIndex;
}): CodeEvaluatorActionResult<CodeEvaluatorDraftSnapshot> {
  switch (operation.type) {
    case "set_source_code":
      return {
        ok: true,
        output: { ...snapshot, sourceCode: operation.sourceCode },
      };
    case "set_language":
      return applyLanguageOperation({
        snapshot,
        language: operation.language,
        sandboxConfigs,
      });
    case "set_sandbox_config":
      return applySandboxConfigOperation({
        snapshot,
        sandboxConfigId: operation.sandboxConfigId,
        sandboxConfigs,
      });
    case "set_input_mapping":
      return {
        ok: true,
        output: { ...snapshot, inputMapping: operation.inputMapping },
      };
    case "set_test_payload":
      return {
        ok: true,
        output: { ...snapshot, testPayload: operation.testPayload },
      };
    case "set_description":
      return {
        ok: true,
        output: { ...snapshot, description: operation.description },
      };
    case "set_name":
      return { ok: true, output: { ...snapshot, name: operation.name } };
    case "set_output_configs":
      return {
        ok: true,
        output: { ...snapshot, outputConfigs: operation.outputConfigs },
      };
    default:
      throw new Error("Unknown code evaluator draft operation");
  }
}

function applyLanguageOperation({
  snapshot,
  language,
  sandboxConfigs,
}: {
  snapshot: CodeEvaluatorDraftSnapshot;
  language: CodeEvaluatorDraftSnapshot["language"];
  sandboxConfigs: SandboxConfigIndex;
}): CodeEvaluatorActionResult<CodeEvaluatorDraftSnapshot> {
  if (snapshot.mode === "edit") {
    return {
      ok: false,
      error:
        "Language is immutable on an existing code evaluator; remove the `set_language` operation.",
    };
  }
  const selectedConfig = snapshot.sandboxConfigId
    ? sandboxConfigs[snapshot.sandboxConfigId]
    : undefined;
  const sandboxConfigId =
    selectedConfig?.language === language ? snapshot.sandboxConfigId : null;
  return { ok: true, output: { ...snapshot, language, sandboxConfigId } };
}

function applySandboxConfigOperation({
  snapshot,
  sandboxConfigId,
  sandboxConfigs,
}: {
  snapshot: CodeEvaluatorDraftSnapshot;
  sandboxConfigId: string | null;
  sandboxConfigs: SandboxConfigIndex;
}): CodeEvaluatorActionResult<CodeEvaluatorDraftSnapshot> {
  if (snapshot.mode === "create" && sandboxConfigId == null) {
    return {
      ok: false,
      error: getMissingCreateSandboxConfigError(snapshot.language),
    };
  }
  const config =
    sandboxConfigId == null ? undefined : sandboxConfigs[sandboxConfigId];
  if (sandboxConfigId != null && !config) {
    return {
      ok: false,
      error: `Sandbox config ${sandboxConfigId} is not available.`,
    };
  }
  if (config && config.language !== snapshot.language) {
    return {
      ok: false,
      error: `Sandbox config ${sandboxConfigId} is configured for ${config.language}, which does not match the draft language ${snapshot.language}.`,
    };
  }
  return { ok: true, output: { ...snapshot, sandboxConfigId } };
}
