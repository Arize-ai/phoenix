import { Meta, StoryFn } from "@storybook/react";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Modal,
  ModalOverlay,
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
    <ModalOverlay>
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
                Lorem ipsum dolor sit amet consectetur adipisicing elit.
                Quisquam, quos.
              </Text>
            </View>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  </DialogTrigger>
);

export const Default = Template.bind({});

const SlideoverTemplate: StoryFn<ModalProps> = (args) => (
  <DialogTrigger>
    <Button>Open Modal</Button>
    <ModalOverlay>
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
                Lorem ipsum dolor sit amet consectetur adipisicing elit.
                Quisquam, quos.
              </Text>
            </View>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  </DialogTrigger>
);

export const Slideover = SlideoverTemplate.bind({});

const NoOverlayTemplate: StoryFn<ModalProps> = (args) => (
  <Flex gap="size-200" direction="column">
    <DialogTrigger>
      <Button>Open Normal Modal</Button>
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
                Lorem ipsum dolor sit amet consectetur adipisicing elit.
                Quisquam, quos.
              </Text>
            </View>
          </DialogContent>
        </Dialog>
      </Modal>
    </DialogTrigger>
    <DialogTrigger>
      <Button>Open Slideover Modal</Button>
      <Modal variant="slideover" {...args}>
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modal Title</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton slot="close" />
              </DialogTitleExtra>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </Modal>
    </DialogTrigger>
  </Flex>
);

export const NoOverlay = NoOverlayTemplate.bind({});
