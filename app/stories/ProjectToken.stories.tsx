import type { Meta, StoryObj } from "@storybook/react";

import { Flex } from "@phoenix/components";
import { ProjectToken } from "@phoenix/components/project";

const GRADIENTS = [
  { gradientStartColor: "#5bdbff", gradientEndColor: "#1c76fd" },
  { gradientStartColor: "#ff8a00", gradientEndColor: "#e52e71" },
  { gradientStartColor: "#00c853", gradientEndColor: "#00bfa5" },
  { gradientStartColor: "#aa00ff", gradientEndColor: "#6200ea" },
];

const meta: Meta<typeof ProjectToken> = {
  title: "Project/ProjectToken",
  component: ProjectToken,
  parameters: {
    layout: "centered",
  },
  args: {
    projectId: "UHJvamVjdDox",
    name: "playground",
    ...GRADIENTS[0],
  },
};

export default meta;

type Story = StoryObj<typeof ProjectToken>;

export const Default: Story = {};

export const Removable: Story = {
  args: {
    onRemove: () => {},
  },
};

/**
 * The gradient circle and the remove button sit centered inside the pill's
 * rounded end caps at every size.
 */
export const Sizes: Story = {
  render: (args) => (
    <Flex direction="column" gap="size-100" alignItems="start">
      <ProjectToken {...args} size="S" onRemove={() => {}} />
      <ProjectToken {...args} size="M" onRemove={() => {}} />
      <ProjectToken {...args} size="L" onRemove={() => {}} />
    </Flex>
  ),
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
    onRemove: () => {},
  },
};

export const LongNameTruncates: Story = {
  args: {
    name: "Experiment-290ba7ca2ae625cb3832abb3-with-an-even-longer-suffix",
    size: "L",
    onRemove: () => {},
  },
};

/**
 * A wrapped token list as rendered in the retention policy detail view.
 */
export const TokenList: Story = {
  render: (args) => (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--global-dimension-size-50)",
        maxWidth: 480,
      }}
    >
      {[
        "Experiment-290ba7ca2ae625cb3832abb3",
        "Experiment-359712869225d56198f0508a",
        "Experiment-3c91d6c37537bd63d79a3b1c",
        "playground",
        "default",
        "eve-agent",
      ].map((name, index) => (
        <li key={name}>
          <ProjectToken
            {...args}
            name={name}
            size="L"
            maxWidth="100%"
            {...GRADIENTS[index % GRADIENTS.length]}
            onRemove={() => {}}
          />
        </li>
      ))}
    </ul>
  ),
};
