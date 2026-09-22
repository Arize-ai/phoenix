import type { Meta, StoryObj } from "@storybook/react";

import {
  ContentSkeleton,
  Flex,
  Skeleton,
  Text,
  TextSkeleton,
} from "@phoenix/components";

const meta: Meta<typeof Skeleton> = {
  title: "Core/Feedback/Skeleton",
  component: Skeleton,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  args: {
    width: 200,
    height: 20,
  },
};

export const Circular: Story = {
  args: {
    width: 40,
    height: 40,
    borderRadius: "50%",
  },
};

export const Rectangular: Story = {
  args: {
    width: 200,
    height: 100,
    borderRadius: 0,
  },
};

export const TextBlock: Story = {
  render: () => (
    <Flex direction="column" gap="size-100" width="300px">
      <Skeleton height={24} />
      <Skeleton height={24} />
      <Skeleton height={24} width="60%" />
    </Flex>
  ),
};

export const Card: Story = {
  render: () => (
    <Flex direction="column" gap="size-100" width="300px">
      <Skeleton height={200} borderRadius={8} />
      <Skeleton height={24} width="80%" />
      <Skeleton height={16} width="60%" />
    </Flex>
  ),
};

export const Content: Story = {
  render: () => <ContentSkeleton />,
};

/**
 * `TextSkeleton` stands in for one line of `Text`. It takes the line height
 * of the size it stands in for, so a row of text and its skeleton are the
 * same height and nothing moves when the text arrives.
 */
export const TextLine: Story = {
  render: () => (
    <Flex direction="column" gap="size-100" width="300px">
      {(["XS", "S", "M", "L"] as const).map((size) => (
        <Flex key={size} direction="row" gap="size-200" alignItems="start">
          <Text size={size}>Text size {size}</Text>
          <TextSkeleton size={size} width={120} />
        </Flex>
      ))}
    </Flex>
  ),
};
