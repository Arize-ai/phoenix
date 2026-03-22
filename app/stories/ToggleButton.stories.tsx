import type { Meta, StoryFn } from "@storybook/react";
import { useState } from "react";

import { Icon, Icons, ToggleButton } from "@phoenix/components";

export default {
  title: "Core/Actions/Toggle Button",
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
    leadingVisual: <Icon svg={<Icons.PlusCircleOutline />} />,
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
