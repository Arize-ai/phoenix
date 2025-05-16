import { Meta, StoryFn } from "@storybook/react";

import { Card } from "@arizeai/components";

import {
  Icon,
  Icons,
  Radio,
  RadioGroup,
  type RadioGroupProps,
} from "@phoenix/components";

const meta: Meta = {
  title: "RadioGroup",
  component: RadioGroup,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<RadioGroupProps> = (args) => (
  <Card title="RadioGroup" bodyStyle={{ width: "600px" }} variant="compact">
    <RadioGroup aria-label="RadioGroup" {...args}>
      <Radio aria-label="Option 1" value="1">
        Option 1
      </Radio>
      <Radio aria-label="Option 2" value="2">
        Option 2
      </Radio>
      <Radio aria-label="Option 3" value="3">
        Option 3
      </Radio>
    </RadioGroup>
  </Card>
);

export const Default: Meta<typeof RadioGroup> = {
  render: Template,
  args: { size: "M", isDisabled: false, defaultValue: "1" },
  argTypes: {
    size: {
      control: { type: "select", options: ["S", "M", "L"] },
    },
  },
};

const AsIconTemplate: StoryFn<RadioGroupProps> = (args) => (
  <Card title="RadioGroup" bodyStyle={{ width: "600px" }} variant="compact">
    <RadioGroup aria-label="RadioGroupWithIcons" {...args}>
      <Radio aria-label="Option 1" value="1">
        <Icon svg={<Icons.Info />} />
      </Radio>
      <Radio aria-label="Option 2" value="2">
        <Icon svg={<Icons.Info />} />
      </Radio>
      <Radio aria-label="Option 3" value="3">
        <Icon svg={<Icons.Info />} />
      </Radio>
    </RadioGroup>
  </Card>
);

export const AsIcon: Meta<typeof RadioGroup> = {
  render: AsIconTemplate,
  args: { size: "M", isDisabled: false, defaultValue: "1" },
  argTypes: {
    size: {
      control: { type: "select", options: ["S", "M", "L"] },
    },
  },
};
