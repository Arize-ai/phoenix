import type { Meta, StoryObj } from "@storybook/react";

import { Flex } from "@phoenix/components";
import { AnnotationTargetTypeBadge } from "@phoenix/components/annotation/AnnotationTargetTypeBadge";

const meta = {
  title: "Annotation/Annotation Target Type Badge",
  component: AnnotationTargetTypeBadge,
  parameters: {
    layout: "centered",
  },
  args: {
    targetType: "span",
  },
} satisfies Meta<typeof AnnotationTargetTypeBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllTargetTypes: Story = {
  render: () => (
    <Flex direction="row" gap="size-100">
      <AnnotationTargetTypeBadge targetType="span" />
      <AnnotationTargetTypeBadge targetType="trace" />
      <AnnotationTargetTypeBadge targetType="session" />
    </Flex>
  ),
};
