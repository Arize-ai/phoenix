import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import { useState } from "react";

import {
  Card,
  Icon,
  Icons,
  ToggleButton,
  ToggleButtonGroup,
  type ToggleButtonGroupProps,
  View,
} from "@phoenix/components";

/**
 * ToggleButton is a button with a selected state that persists between
 * presses. `ToggleButtonGroup` arranges several of them as one segmented
 * control with single or multiple selection; the `Group…` stories render it.
 */
export default {
  title: "Design System/Actions/Toggle Button",
  tags: ["legacy", "unreviewed"],
  component: ToggleButton,
  parameters: {
    layout: "centered",
  },
} as Meta<typeof ToggleButton>;

const Template: StoryFn<typeof ToggleButton> = (args) => {
  const [selected, setSelected] = useState(args.isSelected);
  return (
    <ToggleButton
      {...args}
      isSelected={selected}
      onPress={() => setSelected(!selected)}
    />
  );
};

export const Basic = {
  render: Template,

  args: {
    children: "Click Me",
    isSelected: false,
  },
};

export const Selected = {
  render: Template,

  args: {
    children: "Selected Button",
    isSelected: true,
  },
};

export const WithIcon = {
  render: Template,

  args: {
    children: "With Icon",
    isSelected: false,
    leadingVisual: <Icon svg={<Icons.PlusCircle />} />,
  },
};

export const Disabled = {
  render: Template,

  args: {
    children: "Disabled Button",
    isSelected: false,
    isDisabled: true,
    onPress: () => {},
  },
};

const GroupTemplate: StoryFn<ToggleButtonGroupProps> = (args) => (
  <Card title="ToggleButtonGroup">
    <View width="600px" padding="size-200">
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
    </View>
  </Card>
);

export const GroupDefault: Meta<typeof ToggleButtonGroup> = {
  render: GroupTemplate,
  args: {
    size: "M",
    isDisabled: false,
    defaultSelectedKeys: ["1", "3"],
    selectionMode: "multiple",
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

const GroupAsIconTemplate: StoryFn<ToggleButtonGroupProps> = (args) => (
  <Card title="ToggleButtonGroup">
    <View width="600px" padding="size-200">
      <ToggleButtonGroup aria-label="ToggleButtonGroupWithIcons" {...args}>
        <ToggleButton aria-label="Option 1" id="1">
          <Icon svg={<Icons.InfoFilled />} />
        </ToggleButton>
        <ToggleButton aria-label="Option 2" id="2">
          <Icon svg={<Icons.InfoFilled />} />
        </ToggleButton>
        <ToggleButton aria-label="Option 3" id="3">
          <Icon svg={<Icons.InfoFilled />} />
        </ToggleButton>
      </ToggleButtonGroup>
    </View>
  </Card>
);

export const GroupAsIcon: Meta<typeof ToggleButtonGroup> = {
  render: GroupAsIconTemplate,
  args: {
    size: "M",
    isDisabled: false,
    defaultSelectedKeys: ["1", "3"],
    selectionMode: "multiple",
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

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj<typeof ToggleButton> = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ display: "flex", gap: "var(--global-dimension-size-100)" }}>
      <ToggleButton defaultSelected>Selected</ToggleButton>
      <ToggleButton>Unselected</ToggleButton>
    </div>
  ),
};
