import type { Meta, StoryFn } from "@storybook/react";

import type { DialogTriggerProps } from "@phoenix/components";
import {
  Button,
  Dialog,
  DialogTrigger,
  Popover,
  PopoverArrow,
  View,
} from "@phoenix/components";

const meta: Meta = {
  title: "Popover",
  component: Popover,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<DialogTriggerProps> = (args) => (
  <DialogTrigger>
    <Button>Settings</Button>
    <Popover {...args}>
      <PopoverArrow />
      <Dialog>
        <View padding="size-100">Dialog Content goes here</View>
      </Dialog>
    </Popover>
  </DialogTrigger>
);

export const Default = Template.bind({});
