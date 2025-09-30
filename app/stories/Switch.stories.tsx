import { useState } from "react";
import { Meta, StoryFn } from "@storybook/react";

import { Flex, Switch, SwitchProps } from "@phoenix/components";

const meta: Meta<SwitchProps> = {
  title: "Switch",
  component: Switch,
  parameters: {
    controls: { expanded: true },
  },
  argTypes: {
    isSelected: {
      control: "boolean",
      description: "Whether the switch is selected (on)",
    },
    isDisabled: {
      control: "boolean",
      description: "Whether the switch is disabled",
    },
    isReadOnly: {
      control: "boolean",
      description: "Whether the switch is read-only",
    },
    labelPlacement: {
      control: "radio",
      options: ["start", "end"],
      description: "Position of the label relative to the switch control",
    },
    children: {
      control: "text",
      description: "Label text for the switch",
    },
    onChange: {
      action: "changed",
      description: "Callback fired when the switch state changes",
    },
  },
};

export default meta;

/**
 * Basic switch component with customizable label
 */
const Template: StoryFn<SwitchProps> = (args: SwitchProps) => (
  <Switch {...args} />
);

export const Default = Template.bind({});
Default.args = {
  children: "Enable notifications",
};

/**
 * Controlled switch with state management
 */
export const Controlled = () => {
  const [isSelected, setIsSelected] = useState(false);

  return (
    <Switch isSelected={isSelected} onChange={setIsSelected}>
      {isSelected ? "Notifications enabled" : "Notifications disabled"}
    </Switch>
  );
};

/**
 * Gallery showing essential switch variants
 */
export const Gallery = () => (
  <Flex direction="column" gap="size-100" width="300px">
    <Switch>Default switch</Switch>
    <Switch isSelected>Selected switch</Switch>
    <Switch isDisabled>Disabled switch</Switch>
    <Switch labelPlacement="start">Label start placement</Switch>
  </Flex>
);
