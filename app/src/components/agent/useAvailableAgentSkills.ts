import { graphql, useLazyLoadQuery } from "react-relay";

import { selectActiveContexts } from "@phoenix/agent/context/selectors";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import type { useAvailableAgentSkillsQuery } from "./__generated__/useAvailableAgentSkillsQuery.graphql";

export type AvailableAgentSkill = {
  name: string;
  description: string;
};

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
  const hasPlaygroundContext = contexts.some(
    (context) => context.type === "playground"
  );
  const hasDatasetContext = contexts.some(
    (context) => context.type === "dataset"
  );
  const hasLlmEvaluatorContext = contexts.some(
    (context) => context.type === "llm_evaluator"
  );

  const data = useLazyLoadQuery<useAvailableAgentSkillsQuery>(
    graphql`
      query useAvailableAgentSkillsQuery($input: AvailableAgentSkillsInput) {
        availableAgentSkills(input: $input) {
          name
          description
        }
      }
    `,
    {
      input: {
        hasPlaygroundContext,
        hasDatasetContext,
        hasLlmEvaluatorContext,
      },
    },
    { fetchPolicy: "store-and-network" }
  );

  return data.availableAgentSkills.map((skill) => ({
    name: skill.name,
    description: skill.description,
  }));
}
