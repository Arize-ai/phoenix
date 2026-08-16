import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { SlashCommandMenu } from "@phoenix/components/agent/SlashCommandMenu";
import type { SlashMenuItem } from "@phoenix/components/agent/usePromptSkillCommand";

const containerCSS = css`
  position: relative;
  max-width: 420px;
  width: 100%;
  height: 240px;
`;

const ITEMS: SlashMenuItem[] = [
  {
    name: "debug-trace",
    summary:
      "Investigate traces to identify failure modes and prioritized fixes.",
    kind: "skill",
  },
  {
    name: "annotate-spans",
    summary:
      "Create consistent span or trace annotations and feedback taxonomies.",
    kind: "skill",
  },
  {
    name: "playground",
    summary: "Author, run, compare, and improve prompts in the playground.",
    kind: "skill",
  },
  {
    name: "clear",
    summary: "Clear the conversation and start a new session",
    kind: "command",
  },
];

const ITEMS_WITH_KEYBIND: SlashMenuItem[] = ITEMS.map((item) =>
  item.name === "clear" ? { ...item, keybind: "⌘⇧K" } : item
);

const meta: Meta<typeof SlashCommandMenu> = {
  title: "Agent/SlashCommandMenu",
  component: SlashCommandMenu,
};

export default meta;

type Story = StoryObj<typeof SlashCommandMenu>;

function Demo({ items }: { items: SlashMenuItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  return (
    <div css={containerCSS}>
      <SlashCommandMenu
        items={items}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        onSelect={(index) => alert(`Selected /${items[index]?.name}`)}
        listboxId="story-slash-command-menu"
        getOptionId={(index) => `story-slash-command-menu-option-${index}`}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <Demo items={ITEMS} />,
};

export const WithCommandKeybind: Story = {
  render: () => <Demo items={ITEMS_WITH_KEYBIND} />,
};

export const CommandsOnly: Story = {
  render: () => (
    <Demo items={ITEMS.filter((item) => item.kind === "command")} />
  ),
};
