import { graphql, useLazyLoadQuery } from "react-relay";

import type { useAvailableAgentSkillsQuery } from "./__generated__/useAvailableAgentSkillsQuery.graphql";

export type AvailableAgentSkill = {
  name: string;
  description: string;
  summary: string;
};

/**
 * Load assistant skills.
 */
export function useAvailableAgentSkills(): AvailableAgentSkill[] {
  const data = useLazyLoadQuery<useAvailableAgentSkillsQuery>(
    graphql`
      query useAvailableAgentSkillsQuery {
        availableAgentSkills {
          name
          description
          summary
        }
      }
    `,
    {},
    { fetchPolicy: "store-and-network" }
  );

  return data.availableAgentSkills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    summary: skill.summary,
  }));
}
