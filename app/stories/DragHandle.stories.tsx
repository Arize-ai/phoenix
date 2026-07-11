import type { Meta, StoryObj } from "@storybook/react";

import { Flex, Text, View } from "@phoenix/components";
import { DragHandle } from "@phoenix/components/dnd/DragHandle";

/**
 * `DragHandle` is the shared grab affordance for dnd-kit sortables. Wire its
 * `ref` to `useSortable`'s `handleRef` and place it on the trailing (right)
 * edge of the draggable row so the handle sits in a predictable spot across
 * lists, cards, and table headers.
 */
const meta: Meta<typeof DragHandle> = {
  title: "DnD/DragHandle",
  component: DragHandle,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof DragHandle>;

export const Default: Story = {
  render: () => <DragHandle />,
};

/**
 * The handle sits on the right of a row, trailing the row's content — the
 * placement used by the column selector and reorderable lists.
 */
export const TrailingInRow: Story = {
  render: () => (
    <View
      borderColor="default"
      borderWidth="thin"
      borderRadius="medium"
      width="320px"
    >
      {["Latency", "Tokens", "Status"].map((label) => (
        <View
          key={label}
          paddingStart="size-200"
          paddingEnd="size-100"
          paddingY="size-100"
        >
          <Flex
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Text>{label}</Text>
            <DragHandle aria-label={`Reorder ${label}`} />
          </Flex>
        </View>
      ))}
    </View>
  ),
};
