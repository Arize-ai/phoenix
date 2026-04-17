import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";
import { useState } from "react";

import { Button, Dialog, Drawer, Flex, Text, View } from "@phoenix/components";
import { Heading } from "@phoenix/components/core/content";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/core/dialog";
import { useDefaultDrawerSize } from "@phoenix/components/core/overlay/useDefaultDrawerSize";

const meta: Meta = {
  title: "Core/Overlays/Drawer",
  component: Drawer,
};

export default meta;

const BasicTemplate: StoryFn = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View height="100%">
      <Button onPress={() => setIsOpen(true)}>Open Drawer</Button>
      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <Dialog>
          {({ close }) => (
            <DialogContent>
              <DialogHeader>
                <Flex direction="row" gap="size-200" alignItems="center">
                  <DialogCloseButton close={close} />
                  <DialogTitle>Drawer Title</DialogTitle>
                </Flex>
              </DialogHeader>
              <View padding="size-200">
                <Text>
                  This drawer does not block interaction with the content behind
                  it. Try clicking the button while the drawer is open.
                </Text>
              </View>
            </DialogContent>
          )}
        </Dialog>
      </Drawer>
    </View>
  );
};

export const Default = {
  render: BasicTemplate,
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
 * TracePage — a list of items behind a resizable, non-blocking drawer.
 * Click a row to open (or change) the detail drawer; drag the left edge to
 * resize. The size persists across reloads via `useDefaultDrawerSize`.
 *
 * Content behind the drawer remains fully interactive — click other rows
 * while the drawer is open to switch between items.
 */
const MasterDetailTemplate: StoryFn = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = MOCK_ITEMS.find((item) => item.id === selectedId);

  const { defaultSize, onSizeChange } = useDefaultDrawerSize({
    id: "storybook-drawer-master-detail",
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

      <Drawer
        isOpen={selectedItem != null}
        onClose={() => setSelectedId(null)}
        defaultSize={defaultSize}
        onResize={onSizeChange}
      >
        <Dialog>
          {({ close }) => (
            <DialogContent>
              <DialogHeader>
                <Flex direction="row" gap="size-200" alignItems="center">
                  <DialogCloseButton close={close} />
                  <DialogTitle>{selectedItem?.title}</DialogTitle>
                </Flex>
              </DialogHeader>
              <View padding="size-200">
                <Flex direction="column" gap="size-200">
                  <Flex direction="column" gap="size-50">
                    <Text weight="heavy">Trace ID</Text>
                    <Text color="text-700">{selectedItem?.id}</Text>
                  </Flex>
                  <Flex direction="column" gap="size-50">
                    <Text weight="heavy">Latency</Text>
                    <Text color="text-700">{selectedItem?.latency}</Text>
                  </Flex>
                  <Flex direction="column" gap="size-50">
                    <Text weight="heavy">Status</Text>
                    <Text
                      color={
                        selectedItem?.status === "error" ? "danger" : "success"
                      }
                    >
                      {selectedItem?.status}
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
                      <code>useDefaultDrawerSize</code> hook.
                    </Text>
                  </View>
                </Flex>
              </View>
            </DialogContent>
          )}
        </Dialog>
      </Drawer>
    </View>
  );
};

export const MasterDetail = {
  render: MasterDetailTemplate,
};
