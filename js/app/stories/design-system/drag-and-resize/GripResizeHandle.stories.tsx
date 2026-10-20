import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { Group, Panel } from "react-resizable-panels";

import { Text, View } from "@phoenix/components";
import {
  GRIP_RESIZE_TARGET_MINIMUM_SIZE,
  GripResizeHandle,
} from "@phoenix/components/resize";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A separator for splits that are meant to be dragged: a line a step stronger
 * than the borders around it, with a grip at its middle, that takes the accent
 * color over its hit area, while dragged, and when focused. Pair it with
 * `GRIP_RESIZE_TARGET_MINIMUM_SIZE` on the `Group`, which widens the area the
 * pointer can grab. For a divider that should stay quiet, use
 * `compactResizeHandleCSS` on a plain `Separator`.
 */
const meta: Meta = {
  title: "Design System/Drag and resize/Grip Resize Handle",
  tags: ["updated", "unreviewed", "complete"],
  component: GripResizeHandle,
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const Frame = ({
  width,
  height,
  children,
}: {
  width: string;
  height: string;
  children: ReactNode;
}) => (
  <View
    width={width}
    height={height}
    borderWidth="thin"
    borderColor="default"
    borderRadius="medium"
  >
    {children}
  </View>
);

const Body = ({ children }: { children: ReactNode }) => (
  <View padding="size-200">
    <Text>{children}</Text>
  </View>
);

export const Default: StoryFn = () => (
  <Frame width="480px" height="240px">
    <Group
      orientation="horizontal"
      resizeTargetMinimumSize={GRIP_RESIZE_TARGET_MINIMUM_SIZE}
    >
      <Panel minSize="120px">
        <Body>Form</Body>
      </Panel>
      <GripResizeHandle />
      <Panel minSize="120px">
        <Body>Test bench</Body>
      </Panel>
    </Group>
  </Frame>
);
Default.tags = ["!dev"];

const ORIENTATIONS = [
  { label: 'orientation="horizontal"', code: true, orientation: "horizontal" },
  { label: 'orientation="vertical"', code: true, orientation: "vertical" },
] as const;

/** The grip turns with the line: upright between columns, flat between rows. */
export const Orientations: StoryFn = () => (
  <OptionGrid
    columns={ORIENTATIONS}
    renderCell={(_, column) => (
      <Frame width="260px" height="180px">
        <Group
          orientation={column?.orientation}
          resizeTargetMinimumSize={GRIP_RESIZE_TARGET_MINIMUM_SIZE}
        >
          <Panel minSize="40px">
            <Body>Records</Body>
          </Panel>
          <GripResizeHandle />
          <Panel minSize="40px">
            <Body>Inspector</Body>
          </Panel>
        </Group>
      </Frame>
    )}
  />
);
Orientations.tags = ["!dev"];
Orientations.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <Frame width="288px" height="168px">
      <Group
        orientation="horizontal"
        resizeTargetMinimumSize={GRIP_RESIZE_TARGET_MINIMUM_SIZE}
      >
        <Panel>
          <Body>Form</Body>
        </Panel>
        <GripResizeHandle />
        <Panel>
          <Body>Bench</Body>
        </Panel>
      </Group>
    </Frame>
  ),
};
