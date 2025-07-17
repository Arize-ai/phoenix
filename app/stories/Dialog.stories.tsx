import { useRef, useState } from "react";
import { Meta, StoryFn } from "@storybook/react";

import {
  Button,
  Dialog,
  DialogProps,
  DialogTrigger,
  Popover,
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
  title: "Dialog",
  component: Dialog,
};

export default meta;

const Template: StoryFn<DialogProps> = (args) => (
  <DialogTrigger>
    <Button>Open Main Dialog</Button>
    <Popover>
      <Dialog {...args}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Main Dialog Title</DialogTitle>
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
    </Popover>
  </DialogTrigger>
);

export const Default = Template.bind({});

const ControlledTemplate: StoryFn<DialogProps> = (args) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isMainOpen, setIsMainOpen] = useState(false);
  const [isNestedOpen, setIsNestedOpen] = useState(false);

  return (
    <>
      <DialogTrigger isOpen={isMainOpen} onOpenChange={setIsMainOpen}>
        <Button ref={triggerRef}>Open Main Dialog</Button>
        <Popover>
          <Dialog {...args}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Main Dialog Title</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-200">
                <Text>
                  Lorem ipsum dolor sit amet consectetur adipisicing elit.
                  Quisquam, quos.
                </Text>
                <Button
                  onPress={() => {
                    setIsNestedOpen(true);
                    setIsMainOpen(false);
                  }}
                >
                  Open Nested Dialog
                </Button>
              </View>
            </DialogContent>
          </Dialog>
        </Popover>
      </DialogTrigger>
      <DialogTrigger isOpen={isNestedOpen} onOpenChange={setIsNestedOpen}>
        <Popover triggerRef={triggerRef}>
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nested Dialog Title</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-200">
                <Text>
                  Lorem ipsum dolor sit amet consectetur adipisicing elit.
                  Quisquam, quos.
                </Text>
                <Button
                  onPress={() => {
                    setIsNestedOpen(false);
                    setIsMainOpen(true);
                  }}
                >
                  Open Main Dialog
                </Button>
              </View>
            </DialogContent>
          </Dialog>
        </Popover>
      </DialogTrigger>
    </>
  );
};

export const ControlledNestedDialogs = ControlledTemplate.bind({});
