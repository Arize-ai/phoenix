import type { Meta, StoryFn, StoryObj } from "@storybook/react";

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
  title: "Design System/Overlays/Popover",
  tags: ["legacy", "unreviewed"],
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

export const Default = {
  render: Template,
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ alignSelf: "flex-start" }}>
      <DialogTrigger defaultOpen>
        <Button size="S">Settings</Button>
        <Popover placement="bottom">
          <PopoverArrow />
          <Dialog>
            <View padding="size-200">Popover content</View>
          </Dialog>
        </Popover>
      </DialogTrigger>
    </div>
  ),
};
