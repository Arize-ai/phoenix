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
  title: "Domains/PXI/Slash Command Menu",
  tags: ["legacy", "unreviewed"],
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

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  // The menu is laid out at the prompt input's width, then shrunk.
  parameters: { thumbnail: { scale: 0.66 } },
  // The menu rises above its anchor, so the anchor sits at the bottom.
  render: () => (
    <div style={{ position: "relative", alignSelf: "flex-end", width: 420 }}>
      <SlashCommandMenu
        items={ITEMS}
        activeIndex={0}
        onActiveIndexChange={() => {}}
        onSelect={() => {}}
        listboxId="thumbnail-slash-command-menu"
        getOptionId={(index) => `thumbnail-slash-command-menu-option-${index}`}
      />
    </div>
  ),
};
