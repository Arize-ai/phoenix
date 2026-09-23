import type { Meta, StoryFn } from "@storybook/react";
import { useState } from "react";
import type { Key } from "react-aria-components";

import type { SegmentedControlProps } from "@phoenix/components";
import {
  Flex,
  Icon,
  Icons,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  View,
} from "@phoenix/components";

const meta: Meta<SegmentedControlProps> = {
  title: "Core/Actions/Segmented Control",
  component: SegmentedControl,
  parameters: {
    layout: "centered",
    controls: { expanded: true },
  },
  argTypes: {
    size: {
      control: "radio",
      options: ["S", "M", "L"],
      description: "The size of the control",
    },
    isDisabled: {
      control: "boolean",
      description: "Whether the segmented control is disabled",
    },
    isJustified: {
      control: "boolean",
      description:
        "Whether the items should divide the container width equally",
    },
  },
};

export default meta;

const Template: StoryFn<SegmentedControlProps> = (args) => (
  <SegmentedControl aria-label="Time granularity" {...args}>
    <SegmentedControlItem id="day">Day</SegmentedControlItem>
    <SegmentedControlItem id="week">Week</SegmentedControlItem>
    <SegmentedControlItem id="month">Month</SegmentedControlItem>
    <SegmentedControlItem id="year">Year</SegmentedControlItem>
  </SegmentedControl>
);

export const Default = {
  render: Template,
  args: {
    size: "M",
    isDisabled: false,
    isJustified: false,
  },
};

export const Sizes = () => (
  <Flex direction="column" gap="size-200" alignItems="start">
    {(["S", "M", "L"] as const).map((size) => (
      <SegmentedControl key={size} size={size} aria-label={`Size ${size}`}>
        <SegmentedControlItem id="day">Day</SegmentedControlItem>
        <SegmentedControlItem id="week">Week</SegmentedControlItem>
        <SegmentedControlItem id="month">Month</SegmentedControlItem>
      </SegmentedControl>
    ))}
  </Flex>
);

export const WithIcons = () => (
  <SegmentedControl aria-label="View" defaultSelectedKey="list">
    <SegmentedControlItem id="list">
      <Icon svg={<Icons.List />} />
      <Text>List</Text>
    </SegmentedControlItem>
    <SegmentedControlItem id="grid">
      <Icon svg={<Icons.Grid />} />
      <Text>Grid</Text>
    </SegmentedControlItem>
    <SegmentedControlItem id="chart">
      <Icon svg={<Icons.BarChart />} />
      <Text>Chart</Text>
    </SegmentedControlItem>
  </SegmentedControl>
);

export const IconOnly = () => (
  <SegmentedControl aria-label="View" defaultSelectedKey="list">
    <SegmentedControlItem id="list" aria-label="List view">
      <Icon svg={<Icons.List />} />
    </SegmentedControlItem>
    <SegmentedControlItem id="grid" aria-label="Grid view">
      <Icon svg={<Icons.Grid />} />
    </SegmentedControlItem>
    <SegmentedControlItem id="chart" aria-label="Chart view">
      <Icon svg={<Icons.BarChart />} />
    </SegmentedControlItem>
  </SegmentedControl>
);

/** Stresses the thumb's stretch: the width delta rivals the travel distance. */
export const MixedWidths = () => (
  <SegmentedControl aria-label="Span filter" defaultSelectedKey="all">
    <SegmentedControlItem id="all">All</SegmentedControlItem>
    <SegmentedControlItem id="root">Root Spans</SegmentedControlItem>
    <SegmentedControlItem id="long">
      A Much Longer Segment Label
    </SegmentedControlItem>
  </SegmentedControl>
);

export const Justified = () => (
  <View width="600px">
    <SegmentedControl isJustified aria-label="Time granularity">
      <SegmentedControlItem id="day">Day</SegmentedControlItem>
      <SegmentedControlItem id="week">Week</SegmentedControlItem>
      <SegmentedControlItem id="month">Month</SegmentedControlItem>
      <SegmentedControlItem id="year">Year</SegmentedControlItem>
    </SegmentedControl>
  </View>
);

export const DisabledItem = () => (
  <SegmentedControl aria-label="Time granularity" defaultSelectedKey="day">
    <SegmentedControlItem id="day">Day</SegmentedControlItem>
    <SegmentedControlItem id="week" isDisabled>
      Week
    </SegmentedControlItem>
    <SegmentedControlItem id="month">Month</SegmentedControlItem>
    <SegmentedControlItem id="year">Year</SegmentedControlItem>
  </SegmentedControl>
);

export const Disabled = () => (
  <SegmentedControl isDisabled aria-label="Time granularity">
    <SegmentedControlItem id="day">Day</SegmentedControlItem>
    <SegmentedControlItem id="week">Week</SegmentedControlItem>
    <SegmentedControlItem id="month">Month</SegmentedControlItem>
  </SegmentedControl>
);

const GalleryTemplate: StoryFn<SegmentedControlProps> = (args) => (
  <Flex direction="column" gap="size-300" alignItems="start">
    <Flex direction="column" gap="size-100" alignItems="start">
      <Text size="XS" color="text-700">
        Text only
      </Text>
      <SegmentedControl aria-label="Time granularity" {...args}>
        <SegmentedControlItem id="day">Day</SegmentedControlItem>
        <SegmentedControlItem id="week">Week</SegmentedControlItem>
        <SegmentedControlItem id="month">Month</SegmentedControlItem>
        <SegmentedControlItem id="year">Year</SegmentedControlItem>
      </SegmentedControl>
    </Flex>
    <Flex direction="column" gap="size-100" alignItems="start">
      <Text size="XS" color="text-700">
        Icon and text
      </Text>
      <SegmentedControl aria-label="View" {...args}>
        <SegmentedControlItem id="list">
          <Icon svg={<Icons.List />} />
          <Text>List</Text>
        </SegmentedControlItem>
        <SegmentedControlItem id="grid">
          <Icon svg={<Icons.Grid />} />
          <Text>Grid</Text>
        </SegmentedControlItem>
        <SegmentedControlItem id="chart">
          <Icon svg={<Icons.BarChart />} />
          <Text>Chart</Text>
        </SegmentedControlItem>
      </SegmentedControl>
    </Flex>
    <Flex direction="column" gap="size-100" alignItems="start">
      <Text size="XS" color="text-700">
        Icon only
      </Text>
      <SegmentedControl aria-label="View" {...args}>
        <SegmentedControlItem id="list" aria-label="List view">
          <Icon svg={<Icons.List />} />
        </SegmentedControlItem>
        <SegmentedControlItem id="grid" aria-label="Grid view">
          <Icon svg={<Icons.Grid />} />
        </SegmentedControlItem>
        <SegmentedControlItem id="chart" aria-label="Chart view">
          <Icon svg={<Icons.BarChart />} />
        </SegmentedControlItem>
      </SegmentedControl>
    </Flex>
    <Flex direction="column" gap="size-100" alignItems="start">
      <Text size="XS" color="text-700">
        Disabled item
      </Text>
      <SegmentedControl aria-label="Time granularity" {...args}>
        <SegmentedControlItem id="day">Day</SegmentedControlItem>
        <SegmentedControlItem id="week" isDisabled>
          Week
        </SegmentedControlItem>
        <SegmentedControlItem id="month">Month</SegmentedControlItem>
      </SegmentedControl>
    </Flex>
    <Flex direction="column" gap="size-100" alignItems="start">
      <Text size="XS" color="text-700">
        Justified
      </Text>
      <View width="400px">
        <SegmentedControl aria-label="Time granularity" {...args} isJustified>
          <SegmentedControlItem id="day">Day</SegmentedControlItem>
          <SegmentedControlItem id="week">Week</SegmentedControlItem>
          <SegmentedControlItem id="month">Month</SegmentedControlItem>
        </SegmentedControl>
      </View>
    </Flex>
  </Flex>
);

/** Every variant at once, driven by the shared `size` and `isDisabled` controls. */
export const Gallery = {
  render: GalleryTemplate,
  args: {
    size: "M",
    isDisabled: false,
  },
};

export const Controlled = () => {
  const [selected, setSelected] = useState<Key>("month");

  return (
    <Flex direction="column" gap="size-200" alignItems="start">
      <SegmentedControl
        aria-label="Time granularity"
        selectedKey={selected}
        onSelectionChange={setSelected}
      >
        <SegmentedControlItem id="day">Day</SegmentedControlItem>
        <SegmentedControlItem id="week">Week</SegmentedControlItem>
        <SegmentedControlItem id="month">Month</SegmentedControlItem>
        <SegmentedControlItem id="year">Year</SegmentedControlItem>
      </SegmentedControl>
      <Text>Selected: {String(selected)}</Text>
    </Flex>
  );
};
