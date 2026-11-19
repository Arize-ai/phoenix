import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { useState } from "react";
import type { Key } from "react-aria-components";

import type {
  SegmentedControlItemProps,
  SegmentedControlProps,
} from "@phoenix/components";
import {
  Flex,
  Icon,
  Icons,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  View,
} from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * Switches between a few views of the same content, with exactly one always
 * selected. Unlike a `Toggle Button Group`, the selection can never be
 * emptied; with no `selectedKey` or `defaultSelectedKey`, the first enabled
 * segment is selected.
 *
 * Each segment is a `SegmentedControlItem`. A string child is wrapped in a
 * `Text`; otherwise compose an `Icon`, a `Text`, or both. An icon-only
 * segment needs an `aria-label`.
 */
const meta: Meta<SegmentedControlProps> = {
  title: "Design System/Actions/Segmented Control",
  tags: ["updated", "unreviewed", "incomplete"],
  component: SegmentedControl,
  subcomponents: { SegmentedControlItem },
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

export const Default: StoryFn = () => (
  <SegmentedControl aria-label="JSON view mode" size="S">
    <SegmentedControlItem id="table">Table</SegmentedControlItem>
    <SegmentedControlItem id="json">JSON</SegmentedControlItem>
  </SegmentedControl>
);
Default.tags = ["!dev"];

type Segment = Pick<SegmentedControlItemProps, "id" | "isDisabled"> & {
  label: string;
  icon: ReactNode;
};

const VIEW_SEGMENTS: Segment[] = [
  { id: "grid", label: "Grid", icon: <Icons.GridFilled /> },
  { id: "list", label: "List", icon: <Icons.List /> },
  { id: "metrics", label: "Metrics", icon: <Icons.BarChart /> },
];

type Content = "text" | "icon and text" | "icon";

function ViewControl({
  content,
  segments = VIEW_SEGMENTS,
  ...props
}: Partial<SegmentedControlProps> & {
  content: Content;
  segments?: Segment[];
}) {
  return (
    <SegmentedControl aria-label="Experiment comparison view" {...props}>
      {segments.map(({ id, label, icon, isDisabled }) => (
        <SegmentedControlItem
          key={id}
          id={id}
          isDisabled={isDisabled}
          aria-label={content === "icon" ? label : undefined}
        >
          {content !== "text" ? <Icon svg={icon} /> : null}
          {content !== "icon" ? <Text>{label}</Text> : null}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

const CONTENTS: { label: string; content: Content }[] = [
  { label: "Text", content: "text" },
  { label: "Icon and text", content: "icon and text" },
  { label: "Icon", content: "icon" },
];

const SIZES = (["S", "M", "L"] as const).map((size) => ({
  label: size,
  code: true,
  size,
}));

export const ContentAndSizes: StoryFn = () => (
  <OptionGrid
    rows={CONTENTS}
    columns={SIZES}
    renderCell={(content, size) => (
      <ViewControl content={content.content} size={size?.size} />
    )}
  />
);
ContentAndSizes.tags = ["!dev"];
ContentAndSizes.parameters = { themeLayout: "column" };

const STATES: {
  label: string;
  props: Partial<SegmentedControlProps>;
  metricsItemProps?: Pick<SegmentedControlItemProps, "isDisabled">;
}[] = [
  { label: "enabled", props: {} },
  {
    label: "item disabled",
    props: {},
    metricsItemProps: { isDisabled: true },
  },
  { label: "disabled", props: { isDisabled: true } },
];

export const StatesAndContent: StoryFn = () => (
  <OptionGrid
    rows={STATES}
    columns={CONTENTS}
    renderCell={(state, content) => (
      <ViewControl
        content={content?.content ?? "text"}
        segments={VIEW_SEGMENTS.map((segment) =>
          segment.id === "metrics"
            ? { ...segment, ...state.metricsItemProps }
            : segment
        )}
        size="S"
        {...state.props}
      />
    )}
  />
);
StatesAndContent.tags = ["!dev"];
StatesAndContent.parameters = { themeLayout: "column" };

export const Justified: StoryFn = () => (
  <OptionGrid
    rows={[
      { label: "default", isJustified: false },
      { label: "isJustified", code: true, isJustified: true },
    ]}
    cellWidth="320px"
    justifyCells="start"
    renderCell={(row) => (
      <ViewControl
        content="icon and text"
        size="S"
        isJustified={row.isJustified}
      />
    )}
  />
);
Justified.tags = ["!dev"];
Justified.parameters = { themeLayout: "column" };

const LENGTHS: { label: string; render: () => ReactNode }[] = [
  {
    label: "Two segments",
    render: () => (
      <SegmentedControl aria-label="Annotation view" size="S">
        <SegmentedControlItem id="scores">Scores</SegmentedControlItem>
        <SegmentedControlItem id="labels">Labels</SegmentedControlItem>
      </SegmentedControl>
    ),
  },
  {
    label: "Three segments",
    render: () => (
      <SegmentedControl aria-label="Package manager" size="S">
        <SegmentedControlItem id="npm">npm</SegmentedControlItem>
        <SegmentedControlItem id="pnpm">pnpm</SegmentedControlItem>
        <SegmentedControlItem id="bun">bun</SegmentedControlItem>
      </SegmentedControl>
    ),
  },
  {
    label: "Mixed label widths",
    render: () => (
      <SegmentedControl aria-label="Language" size="S">
        <SegmentedControlItem id="Python">Python</SegmentedControlItem>
        <SegmentedControlItem id="TypeScript">TypeScript</SegmentedControlItem>
      </SegmentedControl>
    ),
  },
  {
    label: "Narrower than its labels",
    render: () => (
      <View width="160px">
        <ViewControl content="icon and text" size="S" />
      </View>
    ),
  },
];

export const ContentLength: StoryFn = () => (
  <OptionGrid rows={LENGTHS} renderCell={(length) => length.render()} />
);
ContentLength.tags = ["!dev"];
ContentLength.parameters = { themeLayout: "column" };

export const Controlled: StoryFn = () => {
  const [selected, setSelected] = useState<Key>("list");
  return (
    <Flex direction="column" gap="size-100" alignItems="start">
      <ViewControl
        content="icon and text"
        size="S"
        selectedKey={selected}
        onSelectionChange={setSelected}
      />
      <Text size="S" color="text-700">
        Selected: {String(selected)}
      </Text>
    </Flex>
  );
};
Controlled.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <ViewControl content="icon and text" defaultSelectedKey="list" />
  ),
};
