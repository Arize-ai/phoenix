import type { LLMEvaluatorDraftSnapshot } from "./types";

/**
 * Stable text rendering of an LLM-evaluator draft snapshot, used as the
 * before/after operands of the pending-approval diff.
 */
export function llmEvaluatorDraftSnapshotToText(
  snapshot: LLMEvaluatorDraftSnapshot
): string {
  return [
    `name: ${snapshot.name}`,
    `description: ${snapshot.description}`,
    `includeExplanation: ${snapshot.includeExplanation}`,
    `inputMapping: ${JSON.stringify(snapshot.inputMapping, null, 2)}`,
    `testPayload: ${JSON.stringify(snapshot.testPayload, null, 2)}`,
    `outputConfigs: ${JSON.stringify(snapshot.outputConfigs, null, 2)}`,
    `judge: ${JSON.stringify(snapshot.judge, null, 2)}`,
  ].join("\n\n");
}

/** Display file name for the LLM-evaluator draft diff. */
export function llmEvaluatorDraftFileName(
  snapshot: LLMEvaluatorDraftSnapshot
): string {
  return snapshot.mode === "edit"
    ? `llm-evaluator-${snapshot.evaluatorNodeId ?? "draft"}.txt`
    : "llm-evaluator-draft.txt";
}
