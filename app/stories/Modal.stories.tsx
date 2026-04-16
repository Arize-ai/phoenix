import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";
import { useState } from "react";

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
import { Heading } from "@phoenix/components/core/content";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { useDefaultModalSize } from "@phoenix/components/core/overlay/useDefaultModalSize";

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

const MOCK_ITEMS = [
  { id: "trace-001", title: "POST /api/chat", latency: "1.2s", status: "ok" },
  {
    id: "trace-002",
    title: "POST /api/chat",
    latency: "3.4s",
    status: "error",
  },
  { id: "trace-003", title: "GET /api/spans", latency: "0.8s", status: "ok" },
  {
    id: "trace-004",
    title: "POST /api/evaluate",
    latency: "5.1s",
    status: "ok",
  },
  { id: "trace-005", title: "POST /api/chat", latency: "2.0s", status: "ok" },
  {
    id: "trace-006",
    title: "GET /api/datasets",
    latency: "0.3s",
    status: "ok",
  },
];

const listItemCSS = css`
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  border-bottom: 1px solid var(--global-border-color-default);
  cursor: pointer;
  &:hover {
    background: var(--global-background-color-hover);
  }
  &[data-selected="true"] {
    background: var(--global-background-color-active);
  }
`;

/**
 * Simulates the master-detail pattern used on pages like SessionPage and
 * TracePage — a list of items behind a resizable, non-masking slideover.
 * Click a row to open (or change) the detail drawer; drag the left edge to
 * resize. The width persists across reloads via `useDefaultModalWidth`.
 */
const SlideoverResizableTemplate: StoryFn<ModalProps> = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = MOCK_ITEMS.find((item) => item.id === selectedId);

  const { defaultSize, onSizeChange } = useDefaultModalSize({
    id: "storybook-slideover-resizable",
  });

  return (
    <View height="100%">
      <Flex direction="column" gap="size-0">
        <View
          padding="size-200"
          borderBottomWidth="thin"
          borderBottomColor="default"
        >
          <Heading level={3}>Traces</Heading>
        </View>
        {MOCK_ITEMS.map((item) => (
          <div
            key={item.id}
            css={listItemCSS}
            data-selected={item.id === selectedId ? "true" : undefined}
            onClick={() => setSelectedId(item.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setSelectedId(item.id);
            }}
          >
            <Flex justifyContent="space-between" alignItems="center">
              <Flex direction="column" gap="size-25">
                <Text weight="heavy">{item.title}</Text>
                <Text color="text-700">{item.id}</Text>
              </Flex>
              <Flex gap="size-200" alignItems="center">
                <Text color="text-700">{item.latency}</Text>
                <Text
                  color={item.status === "error" ? "danger" : "success"}
                  weight="heavy"
                >
                  {item.status}
                </Text>
              </Flex>
            </Flex>
          </div>
        ))}
      </Flex>

      {selectedItem && (
        <Modal
          variant="slideover"
          isResizable
          isOpen
          defaultSize={defaultSize}
          onResize={onSizeChange}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedId(null);
          }}
        >
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <Flex direction="row" gap="size-200" alignItems="center">
                  <DialogCloseButton slot="close" />
                  <DialogTitle>{selectedItem.title}</DialogTitle>
                </Flex>
              </DialogHeader>
              <View padding="size-200">
                <Flex direction="column" gap="size-200">
                  <Flex direction="column" gap="size-50">
                    <Text weight="heavy">Trace ID</Text>
                    <Text color="text-700">{selectedItem.id}</Text>
                  </Flex>
                  <Flex direction="column" gap="size-50">
                    <Text weight="heavy">Latency</Text>
                    <Text color="text-700">{selectedItem.latency}</Text>
                  </Flex>
                  <Flex direction="column" gap="size-50">
                    <Text weight="heavy">Status</Text>
                    <Text
                      color={
                        selectedItem.status === "error" ? "danger" : "success"
                      }
                    >
                      {selectedItem.status}
                    </Text>
                  </Flex>
                  <View
                    padding="size-200"
                    borderWidth="thin"
                    borderColor="default"
                    borderRadius="medium"
                  >
                    <Text color="text-700">
                      Click other rows in the list to navigate between traces
                      while the drawer stays open. Drag the left edge to resize.
                      The width persists across page reloads via the{" "}
                      <code>useDefaultModalSize</code> hook.
                    </Text>
                  </View>
                </Flex>
              </View>
            </DialogContent>
          </Dialog>
        </Modal>
      )}
    </View>
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
        defaultSize="35%"
        minSize={300}
        maxSize="85%"
        onResize={() => {}}
      />

      {/* @ts-expect-error isResizable requires variant="slideover" */}
      <Modal isResizable />
      {/* @ts-expect-error isResizable is not allowed on variant="default" */}
      <Modal variant="default" isResizable />
      {/* @ts-expect-error defaultSize requires isResizable */}
      <Modal variant="slideover" defaultSize="35%" />
      {/* @ts-expect-error onResize requires isResizable */}
      <Modal variant="slideover" isResizable={false} onResize={() => {}} />
      {/* @ts-expect-error minSize requires isResizable */}
      <Modal variant="slideover" minSize={300} />
    </>
  );
}
