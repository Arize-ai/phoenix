import type { Meta, StoryObj } from "@storybook/react";

import { Flex } from "@phoenix/components";
import { AnnotationTargetTypeToken } from "@phoenix/components/annotation/AnnotationTargetTypeToken";

const meta = {
  title: "Domains/Annotations/Annotation Target Type Token",
  tags: ["legacy", "unreviewed"],
  component: AnnotationTargetTypeToken,
  parameters: {
    layout: "centered",
  },
  args: {
    targetType: "span",
  },
} satisfies Meta<typeof AnnotationTargetTypeToken>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllTargetTypes: Story = {
  render: () => (
    <Flex direction="row" gap="size-100">
      <AnnotationTargetTypeToken targetType="span" />
      <AnnotationTargetTypeToken targetType="trace" />
      <AnnotationTargetTypeToken targetType="session" />
    </Flex>
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  ...AllTargetTypes,
  tags: ["!dev", "!autodocs"],
};
