import { graphql, useLazyLoadQuery } from "react-relay";

import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import { selectActiveContexts } from "@phoenix/agent/context/selectors";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import type { useAvailableAgentSkillsQuery } from "./__generated__/useAvailableAgentSkillsQuery.graphql";

export type AvailableAgentSkill = {
  name: string;
  description: string;
  summary: string;
};

type AvailableAgentSkillsInput = {
  hasPlaygroundContext: boolean;
  hasDatasetContext: boolean;
  hasLlmEvaluatorContext: boolean;
};

function buildAvailableAgentSkillsInput(
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

/**
 * Load the assistant skills available for the current UI context.
 *
 * Derives the context-presence flags from the active agent contexts (the same
 * source the chat request uses) and asks the server which skills it would offer
 * for that context. The list mirrors what the agent itself receives, so the
 * prompt UI only surfaces skills that can actually be loaded.
 */
export function useAvailableAgentSkills(): AvailableAgentSkill[] {
  const contexts = useAgentContext(selectActiveContexts);
  const input = buildAvailableAgentSkillsInput(contexts);

  const data = useLazyLoadQuery<useAvailableAgentSkillsQuery>(
    graphql`
      query useAvailableAgentSkillsQuery($input: AvailableAgentSkillsInput) {
        availableAgentSkills(input: $input) {
          name
          description
          summary
        }
      }
    `,
    {
      input,
    },
    { fetchPolicy: "store-and-network" }
  );

  return data.availableAgentSkills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    summary: skill.summary,
  }));
}
