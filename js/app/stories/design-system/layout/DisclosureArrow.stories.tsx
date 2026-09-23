import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import { useState } from "react";

import type { DisclosureArrowProps } from "@phoenix/components";
import { DisclosureArrow, Flex, Text, View } from "@phoenix/components";

const meta: Meta = {
  title: "Design System/Layout/Disclosure Arrow",
  tags: ["legacy", "unreviewed"],
  component: DisclosureArrow,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    position: {
      control: { type: "radio" },
      options: ["start", "end"],
    },
  },
};

export default meta;

const Template: StoryFn<DisclosureArrowProps> = (args) => (
  <View padding="size-200">
    <Flex direction="row" gap="size-100" alignItems="center">
      <DisclosureArrow {...args} />
      <Text>Section Title</Text>
    </Flex>
  </View>
);

/**
 * The canonical collapse / expand affordance. Rotates right → down
 * when placed at the start of a label.
 */
export const Default: Meta<typeof DisclosureArrow> = {
  render: Template,
  args: { isExpanded: false, position: "start" },
};

/**
 * End-positioned arrows (right side of a trigger) rotate down → up.
 */
export const EndPosition: Meta<typeof DisclosureArrow> = {
  render: Template,
  args: { isExpanded: false, position: "end" },
};

const InteractiveStory: StoryFn<DisclosureArrowProps> = (args) => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <button
      className="button--reset"
      onClick={() => setIsExpanded(!isExpanded)}
      style={{ cursor: "pointer" }}
      aria-expanded={isExpanded}
    >
      <Flex direction="row" gap="size-100" alignItems="center">
        <DisclosureArrow {...args} isExpanded={isExpanded} />
        <Text>Click to toggle</Text>
      </Flex>
    </button>
  );
};

export const Interactive: Meta<typeof DisclosureArrow> = {
  render: InteractiveStory,
  args: { position: "start" },
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <Flex direction="column" gap="size-200">
      <Flex direction="row" gap="size-100" alignItems="center">
        <DisclosureArrow isExpanded={false} />
        <Text>Collapsed</Text>
      </Flex>
      <Flex direction="row" gap="size-100" alignItems="center">
        <DisclosureArrow isExpanded />
        <Text>Expanded</Text>
      </Flex>
    </Flex>
  ),
};
