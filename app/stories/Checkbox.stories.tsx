import { Meta, StoryFn } from "@storybook/react";

import { Checkbox } from "@phoenix/components";

const meta: Meta = {
  title: "Checkbox",
  component: Checkbox,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<typeof Checkbox> = (args) => <Checkbox {...args} />;

/**
 * Basic checkbox with label
 */
export const Default = Template.bind({});

Default.args = {
  children: "Checkbox label",
};

/**
 * Pre-checked checkbox
 */
export const Checked = Template.bind({});

Checked.args = {
  children: "Checked checkbox",
  isSelected: true,
};

/**
 * Disabled checkbox
 */
export const Disabled = Template.bind({});

Disabled.args = {
  children: "Disabled checkbox",
  isDisabled: true,
};

/**
 * Checkbox in indeterminate state
 */
export const Indeterminate = Template.bind({});

Indeterminate.args = {
  children: "Indeterminate checkbox",
  isIndeterminate: true,
};

/**
 * Checkbox with custom children content
 */
export const WithChildren = Template.bind({});

WithChildren.args = {
  children: (
    <>
      <strong>Bold text</strong> and <em>italic text</em>
    </>
  ),
};

/**
 * Checkbox with no label
 */
export const NoLabel = Template.bind({});

NoLabel.args = {
  children: null,
};
