import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import type { AvailableAgentSkill } from "@phoenix/agent/skills/availability";
import { SkillMenu } from "@phoenix/components/agent/SkillMenu";

const containerCSS = css`
  position: relative;
  max-width: 420px;
  width: 100%;
  height: 240px;
`;

const SKILLS: AvailableAgentSkill[] = [
  {
    name: "debug-trace",
    description:
      "Diagnose failure modes by systematically investigating traces.",
    summary:
      "Investigate traces to identify failure modes and prioritized fixes.",
  },
  {
    name: "annotate-spans",
    description:
      "Write effective, consistent annotations on LLM/agent spans and traces.",
    summary:
      "Create consistent span or trace annotations and feedback taxonomies.",
  },
  {
    name: "playground",
    description: "Author and iterate on prompts in the playground.",
    summary:
      "Author, run, compare, and improve prompts in the playground.",
  },
];

const meta: Meta<typeof SkillMenu> = {
  title: "Agent/SkillMenu",
  component: SkillMenu,
};

export default meta;

type Story = StoryObj<typeof SkillMenu>;

export const Default: Story = {
  render: () => {
    const Demo = () => {
      const [activeIndex, setActiveIndex] = useState(0);
      return (
        <div css={containerCSS}>
          <SkillMenu
            skills={SKILLS}
            activeIndex={activeIndex}
            onActiveIndexChange={setActiveIndex}
            onSelect={(skill) => alert(`Selected /${skill.name}`)}
            listboxId="story-skill-menu"
            getOptionId={(index) => `story-skill-menu-option-${index}`}
          />
        </div>
      );
    };
    return <Demo />;
  },
};
