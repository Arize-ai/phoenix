import type { Meta, StoryObj } from "@storybook/react";

import { Flex, Shimmer } from "@phoenix/components";

const meta: Meta<typeof Shimmer> = {
  title: "AI/Shimmer",
  component: Shimmer,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof Shimmer>;

export const Default: Story = {
  args: {
    children: "Analyzing your data...",
  },
};

export const Sizes: Story = {
  render: () => (
    <Flex direction="column" gap="size-100">
      <Shimmer size="XS">Extra small shimmer text</Shimmer>
      <Shimmer size="S">Small shimmer text</Shimmer>
      <Shimmer size="M">Medium shimmer text</Shimmer>
      <Shimmer size="L">Large shimmer text</Shimmer>
      <Shimmer size="XL">Extra large shimmer text</Shimmer>
      <Shimmer size="XXL">Extra extra large shimmer text</Shimmer>
    </Flex>
  ),
};

export const Weights: Story = {
  render: () => (
    <Flex direction="column" gap="size-100">
      <Shimmer weight="normal">Normal weight shimmer</Shimmer>
      <Shimmer weight="heavy">Heavy weight shimmer</Shimmer>
    </Flex>
  ),
};

export const Speeds: Story = {
  render: () => (
    <Flex direction="column" gap="size-100">
      <Shimmer duration={1}>Fast shimmer (1s)</Shimmer>
      <Shimmer duration={2}>Default shimmer (2s)</Shimmer>
      <Shimmer duration={4}>Slow shimmer (4s)</Shimmer>
    </Flex>
  ),
};

export const LongText: Story = {
  args: {
    children:
      "This is a much longer piece of text that demonstrates how the shimmer effect scales with the length of the content being displayed to the user.",
    size: "M",
  },
};

export const AsHeading: Story = {
  args: {
    children: "AI-Generated Summary",
    elementType: "h2",
    size: "XL",
    weight: "heavy",
  },
};

export const AsSpan: Story = {
  render: () => (
    <p>
      The result is: <Shimmer elementType="span">loading result...</Shimmer>
    </p>
  ),
};
