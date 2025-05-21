import { Meta, StoryFn } from "@storybook/react";

import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalProps,
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
        <Button slot="close">Close</Button>
      </Dialog>
    </Modal>
  </DialogTrigger>
);

export const Default = Template.bind({});
