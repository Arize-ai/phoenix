import type { Meta } from "@storybook/react";
import { useState } from "react";

import type { SwitchProps } from "@phoenix/components";
import { Flex, Switch } from "@phoenix/components";

const meta: Meta<SwitchProps> = {
  title: "Core/Forms/Switch",
  component: Switch,
  parameters: {
    controls: { expanded: true },
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=467-75",
    },
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

export const Default = {
  args: {
    children: "Enable notifications",
  },
};

export const Controlled = () => {
  const [isSelected, setIsSelected] = useState(false);

  return (
    <Switch isSelected={isSelected} onChange={setIsSelected}>
      {isSelected ? "Notifications enabled" : "Notifications disabled"}
    </Switch>
  );
};

export const Gallery = () => (
  <Flex direction="column" gap="size-100" width="300px">
    <Switch>Default switch</Switch>
    <Switch isSelected>Selected switch</Switch>
    <Switch isDisabled>Disabled switch</Switch>
    <Switch labelPlacement="start">Label start placement</Switch>
  </Flex>
);
