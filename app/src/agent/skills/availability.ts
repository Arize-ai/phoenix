import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";

export type AvailableAgentSkill = {
  name: string;
  description: string;
};

export type AvailableAgentSkillsInput = {
  hasPlaygroundContext: boolean;
  hasDatasetContext: boolean;
  hasLlmEvaluatorContext: boolean;
};

/**
 * Project active UI contexts into the availability flags understood by the
 * server-side skill catalog preview.
 */
export function buildAvailableAgentSkillsInput(
  contexts: readonly AgentContext[]
): AvailableAgentSkillsInput {
  return {
    hasPlaygroundContext: contexts.some(
      (context) => context.type === "playground"
    ),
    hasDatasetContext: contexts.some((context) => context.type === "dataset"),
    hasLlmEvaluatorContext: contexts.some(
      (context) => context.type === "llm_evaluator"
    ),
  };
}
