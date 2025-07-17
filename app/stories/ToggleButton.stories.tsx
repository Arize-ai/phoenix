import { useState } from "react";
import { Meta, StoryFn } from "@storybook/react";

import { Icon, Icons, ToggleButton } from "@phoenix/components";

export default {
  title: "ToggleButton",
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

export const Basic = Template.bind({});
Basic.args = {
  children: "Click Me",
  isSelected: false,
};

export const Selected = Template.bind({});
Selected.args = {
  children: "Selected Button",
  isSelected: true,
};

export const WithIcon = Template.bind({});
WithIcon.args = {
  children: "With Icon",
  isSelected: false,
  leadingVisual: <Icon svg={<Icons.PlusCircleOutline />} />,
};

export const Disabled = Template.bind({});
Disabled.args = {
  children: "Disabled Button",
  isSelected: false,
  isDisabled: true,
  onPress: () => {},
};
