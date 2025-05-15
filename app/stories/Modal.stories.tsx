import { Meta, StoryFn } from "@storybook/react";

import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalProps,
  View,
} from "@phoenix/components";

const meta: Meta = {
  title: "Modal",
  component: Modal,
};

export default meta;

const Template: StoryFn<ModalProps> = (args) => (
  <DialogTrigger>
    <Button>Open Modal</Button>
    <Modal {...args}>
      <Dialog>
        <Heading slot="title">Modal Title</Heading>
        <View padding="size-200">
          <Button slot="close">Close</Button>
        </View>
      </Dialog>
    </Modal>
  </DialogTrigger>
);

export const Default = Template.bind({});
