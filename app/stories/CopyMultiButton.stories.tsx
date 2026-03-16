import type { Meta, StoryFn } from "@storybook/react";

import { CopyMultiButton } from "../src/components/core/copy/CopyMultiButton";
import type { CopyMultiButtonProps } from "../src/components/core/copy/CopyMultiButton";

const meta: Meta = {
  title: "Core/Actions/CopyMultiButton",
  component: CopyMultiButton,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<CopyMultiButtonProps> = (args) => (
  <CopyMultiButton {...args} />
);

/**
 * A labeled "Copy" button with a dropdown caret that reveals multiple copy
 * targets. The button reads "Copy" and the menu items identify what is being
 * copied (e.g. "Span ID", "Trace ID").
 */
export const Default = Template.bind({});

Default.args = {
  items: [
    {
      name: "Span ID",
      value: "span-abc123def456",
    },
    {
      name: "Trace ID",
      value: "trace-789ghi012jkl",
    },
  ],
};

/**
 * Multi-copy with three targets.
 */
export const ThreeItems = Template.bind({});

ThreeItems.args = {
  items: [
    {
      name: "Span ID",
      value: "span-abc123",
    },
    {
      name: "Trace ID",
      value: "trace-def456",
    },
    {
      name: "Project ID",
      value: "project-ghi789",
    },
  ],
};
