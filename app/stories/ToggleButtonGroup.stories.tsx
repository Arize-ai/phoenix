import { Meta, StoryFn } from "@storybook/react";

import { Card } from "@arizeai/components";

import {
  Icon,
  Icons,
  ToggleButton,
  ToggleButtonGroup,
  type ToggleButtonGroupProps,
} from "@phoenix/components";

const meta: Meta = {
  title: "ToggleButtonGroup",
  component: ToggleButtonGroup,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<ToggleButtonGroupProps> = (args) => (
  <Card
    title="ToggleButtonGroup"
    bodyStyle={{ width: "600px" }}
    variant="compact"
  >
    <ToggleButtonGroup aria-label="ToggleButtonGroup" {...args}>
      <ToggleButton aria-label="Option 1" id="1">
        Option 1
      </ToggleButton>
      <ToggleButton aria-label="Option 2" id="2">
        Option 2
      </ToggleButton>
      <ToggleButton aria-label="Option 3" id="3">
        Option 3
      </ToggleButton>
    </ToggleButtonGroup>
  </Card>
);

export const Default: Meta<typeof ToggleButtonGroup> = {
  render: Template,
  args: {
    size: "M",
    isDisabled: false,
    defaultSelectedKeys: ["1"],
    selectionMode: "single",
  },
  argTypes: {
    size: {
      control: { type: "select", options: ["S", "M", "L"] },
    },
    selectionMode: {
      control: { type: "select", options: ["single", "multiple"] },
    },
  },
};

const AsIconTemplate: StoryFn<ToggleButtonGroupProps> = (args) => (
  <Card
    title="ToggleButtonGroup"
    bodyStyle={{ width: "600px" }}
    variant="compact"
  >
    <ToggleButtonGroup aria-label="ToggleButtonGroupWithIcons" {...args}>
      <ToggleButton aria-label="Option 1" id="1">
        <Icon svg={<Icons.Info />} />
      </ToggleButton>
      <ToggleButton aria-label="Option 2" id="2">
        <Icon svg={<Icons.Info />} />
      </ToggleButton>
      <ToggleButton aria-label="Option 3" id="3">
        <Icon svg={<Icons.Info />} />
      </ToggleButton>
    </ToggleButtonGroup>
  </Card>
);

export const AsIcon: Meta<typeof ToggleButtonGroup> = {
  render: AsIconTemplate,
  args: {
    size: "M",
    isDisabled: false,
    defaultSelectedKeys: ["1"],
    selectionMode: "single",
  },
  argTypes: {
    size: {
      control: { type: "select" },
      options: ["S", "M", "L"],
    },
    selectionMode: {
      control: { type: "select" },
      options: ["single", "multiple"],
    },
  },
};
