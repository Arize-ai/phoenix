import type { Meta, StoryFn } from "@storybook/react";

import type { ModalProps } from "@phoenix/components";
import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { useDefaultModalWidth } from "@phoenix/components/core/overlay/useDefaultModalWidth";

const meta: Meta = {
  title: "Core/Overlays/Modal",
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

export const Default = {
  render: Template,
};

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

export const Slideover = {
  render: SlideoverTemplate,
};

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

export const NoOverlay = {
  render: NoOverlayTemplate,
};

const SlideoverResizableTemplate: StoryFn<ModalProps> = () => {
  // Demonstrates the `react-resizable-panels`-style hook pattern: the caller
  // owns persistence, the hook reads the stored width on first render and
  // returns an `onWidthChange` that writes back on every commit. Drag the
  // drawer, reload the Storybook frame, and the width should stick.
  const { defaultWidth, onWidthChange } = useDefaultModalWidth({
    id: "storybook-slideover-resizable",
  });
  return (
    <Flex direction="column" gap="size-200">
      <Text>
        Click the button behind the slideover to confirm the background stays
        interactive. Drag the left edge of the slideover to resize — the width
        is persisted via <code>useDefaultModalWidth</code>.
      </Text>
      <Flex direction="row" gap="size-200">
        <Button
          onPress={() => {
            // eslint-disable-next-line no-console
            console.log("background button clicked");
          }}
        >
          Background button (should stay clickable)
        </Button>
        <DialogTrigger>
          <Button>Open Resizable Slideover</Button>
          <Modal
            variant="slideover"
            isResizable
            defaultWidth={defaultWidth}
            onResize={onWidthChange}
          >
            <Dialog>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Resizable Slideover</DialogTitle>
                  <DialogTitleExtra>
                    <DialogCloseButton slot="close" />
                  </DialogTitleExtra>
                </DialogHeader>
                <View padding="size-200">
                  <Text>
                    This slideover has no backdrop and a draggable left edge.
                    Grab the thin strip at the left border and drag horizontally
                    to resize.
                  </Text>
                </View>
              </DialogContent>
            </Dialog>
          </Modal>
        </DialogTrigger>
      </Flex>
    </Flex>
  );
};

export const SlideoverResizable = {
  render: SlideoverResizableTemplate,
};

// Type-level tests for the `ModalProps` discriminated union. These aren't rendered;
// they exist so `tsc --noEmit` fails loudly if someone weakens the union and the
// invalid combinations below start being accepted.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _ModalPropsTypeTests() {
  return (
    <>
      {/* ok: default variant, no resize props */}
      <Modal />
      {/* ok: slideover variant, existing behavior */}
      <Modal variant="slideover" size="L" />
      {/* ok: resizable slideover with all resize props */}
      <Modal
        variant="slideover"
        isResizable
        defaultWidth={500}
        minWidth={300}
        maxWidth={900}
        onResize={() => {}}
      />

      {/* @ts-expect-error isResizable requires variant="slideover" */}
      <Modal isResizable />
      {/* @ts-expect-error isResizable is not allowed on variant="default" */}
      <Modal variant="default" isResizable />
      {/* @ts-expect-error defaultWidth requires isResizable */}
      <Modal variant="slideover" defaultWidth={500} />
      {/* @ts-expect-error onResize requires isResizable */}
      <Modal variant="slideover" isResizable={false} onResize={() => {}} />
      {/* @ts-expect-error minWidth requires isResizable */}
      <Modal variant="slideover" minWidth={300} />
    </>
  );
}
