import type { CodeEvaluatorDraftSnapshot } from "./types";

/**
 * Stable text rendering of a code-evaluator draft snapshot, used as the
 * before/after operands of the pending-approval diff.
 */
export function codeEvaluatorDraftSnapshotToText(
  snapshot: CodeEvaluatorDraftSnapshot
): string {
  return [
    `name: ${snapshot.name}`,
    `description: ${snapshot.description}`,
    `language: ${snapshot.language}`,
    `sandboxConfigId: ${snapshot.sandboxConfigId ?? "null"}`,
    `inputMapping: ${JSON.stringify(snapshot.inputMapping, null, 2)}`,
    `testPayload: ${JSON.stringify(snapshot.testPayload, null, 2)}`,
    `outputConfigs: ${JSON.stringify(snapshot.outputConfigs, null, 2)}`,
    `sourceCode:\n${snapshot.sourceCode}`,
  ].join("\n\n");
}

/** Display file name for the code-evaluator draft diff. */
export function codeEvaluatorDraftFileName(
  snapshot: CodeEvaluatorDraftSnapshot
): string {
  return snapshot.mode === "edit"
    ? `code-evaluator-${snapshot.evaluatorNodeId ?? "draft"}.txt`
    : "code-evaluator-draft.txt";
}
