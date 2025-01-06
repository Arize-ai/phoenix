import React from "react";
import { Meta, StoryFn } from "@storybook/react";

import {
  Button,
  Dialog,
  DialogTrigger,
  Popover,
  PopoverArrow,
  PopoverProps,
  View,
} from "@phoenix/components";

import { ThemeWrapper } from "./components/ThemeWrapper";

const meta: Meta = {
  title: "Popover",
  component: Popover,
  parameters: {
    controls: { expanded: true },
  },
  argTypes: {
    selectionMode: {
      options: ["none", "single", "multiple"],
      control: {
        type: "radio",
      },
    },
  },
};

export default meta;

const Template: StoryFn<PopoverProps> = (args) => (
  <ThemeWrapper>
    <DialogTrigger isOpen>
      <Button>Settings</Button>
      <Popover {...args}>
        <PopoverArrow />
        <Dialog>
          <View padding="size-100">Dialog Content goes here</View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  </ThemeWrapper>
);

export const Default = Template.bind({});
