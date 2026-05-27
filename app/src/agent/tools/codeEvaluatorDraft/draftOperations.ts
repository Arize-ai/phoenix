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

/** Applies operations to a draft snapshot; rejects mode/language-incoherent ops. */
export function applyDraftOperations({
  snapshot,
  operations,
  sandboxConfigs,
}: {
  snapshot: CodeEvaluatorDraftSnapshot;
  operations: EditCodeEvaluatorDraftOperation[];
  sandboxConfigs: SandboxConfigIndex;
}): CodeEvaluatorActionResult<CodeEvaluatorDraftSnapshot> {
  let next: CodeEvaluatorDraftSnapshot = { ...snapshot };
  for (const operation of operations) {
    switch (operation.type) {
      case "set_source_code": {
        next = { ...next, sourceCode: operation.sourceCode };
        break;
      }
      case "set_language": {
        if (next.mode === "edit") {
          return {
            ok: false,
            error:
              "Language is immutable on an existing code evaluator; remove the `set_language` operation.",
          };
        }
        const nextLanguage = operation.language;
        let nextSandboxConfigId = next.sandboxConfigId;
        if (nextSandboxConfigId != null) {
          const config = sandboxConfigs[nextSandboxConfigId];
          if (!config || config.language !== nextLanguage) {
            nextSandboxConfigId = null;
          }
        }
        next = {
          ...next,
          language: nextLanguage,
          sandboxConfigId: nextSandboxConfigId,
        };
        break;
      }
      case "set_sandbox_config": {
        const nextSandboxConfigId = operation.sandboxConfigId;
        if (next.mode === "create" && nextSandboxConfigId == null) {
          return {
            ok: false,
            error: getMissingCreateSandboxConfigError(next.language),
          };
        }
        if (nextSandboxConfigId != null) {
          const config = sandboxConfigs[nextSandboxConfigId];
          if (!config) {
            return {
              ok: false,
              error: `Sandbox config ${nextSandboxConfigId} is not available.`,
            };
          }
          if (config.language !== next.language) {
            return {
              ok: false,
              error: `Sandbox config ${nextSandboxConfigId} is configured for ${config.language}, which does not match the draft language ${next.language}.`,
            };
          }
        }
        next = { ...next, sandboxConfigId: nextSandboxConfigId };
        break;
      }
      case "set_input_mapping": {
        next = { ...next, inputMapping: operation.inputMapping };
        break;
      }
      case "set_description": {
        next = { ...next, description: operation.description };
        break;
      }
      case "set_name": {
        next = { ...next, name: operation.name };
        break;
      }
      case "set_output_configs": {
        next = { ...next, outputConfigs: operation.outputConfigs };
        break;
      }
    }
  }
  if (next.mode === "create" && next.sandboxConfigId == null) {
    return {
      ok: false,
      error: getMissingCreateSandboxConfigError(next.language),
    };
  }
  next = { ...next, revision: buildDraftRevision(next) };
  return { ok: true, output: next };
}

/** Djb2 content hash over the snapshot (excluding any prior revision). */
export function buildDraftRevision(
  snapshot: Omit<CodeEvaluatorDraftSnapshot, "revision"> & {
    revision?: string;
  }
): string {
  const { revision: _ignored, ...rest } = snapshot;
  const serialized = JSON.stringify(rest);
  let hash = 5381;
  for (let index = 0; index < serialized.length; index++) {
    hash = (hash * 33) ^ serialized.charCodeAt(index);
  }
  return `code-evaluator-draft-${(hash >>> 0).toString(16)}`;
}
