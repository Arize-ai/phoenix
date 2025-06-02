import { Meta, StoryFn } from "@storybook/react";

import {
  Button,
  Dialog,
  DialogTrigger,
  Modal,
  ModalProps,
  Text,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modal Title</DialogTitle>
            <DialogTitleExtra>
              <DialogCloseButton slot="close" />
            </DialogTitleExtra>
          </DialogHeader>
          <View padding="size-200">
            <Text>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam,
              quos.
            </Text>
          </View>
        </DialogContent>
      </Dialog>
    </Modal>
  </DialogTrigger>
);

export const Default = Template.bind({});

const SlideoverTemplate: StoryFn<ModalProps> = (args) => (
  <DialogTrigger>
    <Button>Open Modal</Button>
    <Modal variant="slideover" {...args}>
      <Dialog>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modal Title</DialogTitle>
            <DialogTitleExtra>
              <DialogCloseButton slot="close" />
            </DialogTitleExtra>
          </DialogHeader>
          <View padding="size-200">
            <Text>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam,
              quos.
            </Text>
          </View>
        </DialogContent>
      </Dialog>
    </Modal>
  </DialogTrigger>
);

export const Slideover = SlideoverTemplate.bind({});
