import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

import type {
  DisclosureGroupProps,
  DisclosureProps,
  DisclosureTriggerProps,
} from "@phoenix/components";
import {
  Card,
  Counter,
  Disclosure,
  DisclosureArrow,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Text,
  View,
} from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A disclosure shows and hides a section of content under a trigger.
 * `Disclosure`, `DisclosureTrigger` and `DisclosurePanel` build each item, and
 * `DisclosureGroup` stacks several of them as an accordion. A `Disclosure`
 * starts expanded unless given `defaultExpanded={false}`, and a group lets
 * several items stay open at once unless given
 * `allowsMultipleExpanded={false}`.
 *
 * Every disclosure surface in Phoenix (cards, accordions, table row
 * expanders, trees, collapsible panels) marks its state with the same
 * rotating chevron, `DisclosureArrow`. Surfaces that do not use a
 * `DisclosureTrigger` render it on its own.
 */
const meta: Meta = {
  title: "Design System/Layout/Disclosure",
  tags: ["updated", "unreviewed", "incomplete"],
  component: Disclosure,
  subcomponents: {
    DisclosureGroup,
    DisclosureTrigger,
    DisclosurePanel,
    DisclosureArrow,
  },
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const CELL_WIDTH = "260px";

const Frame = ({
  width = CELL_WIDTH,
  children,
}: {
  width?: string;
  children: ReactNode;
}) => (
  <View
    width={width}
    borderWidth="thin"
    borderColor="default"
    borderRadius="medium"
  >
    {children}
  </View>
);

const Item = ({
  id,
  title,
  triggerProps,
  ...props
}: Omit<DisclosureProps, "children"> & {
  title: ReactNode;
  triggerProps?: Omit<DisclosureTriggerProps, "children">;
}) => (
  <Disclosure id={id} {...props}>
    <DisclosureTrigger arrowPosition="start" {...triggerProps}>
      {title}
    </DisclosureTrigger>
    <DisclosurePanel>
      <View padding="size-200">
        <Text>Attributes recorded on the span.</Text>
      </View>
    </DisclosurePanel>
  </Disclosure>
);

export const Default: StoryFn = () => (
  <Card title="Span" width="360px">
    <DisclosureGroup defaultExpandedKeys={["attributes"]}>
      <Item id="attributes" title="Attributes" />
      <Item id="events" title="Events" />
    </DisclosureGroup>
  </Card>
);
Default.tags = ["!dev"];

const EXPANSION = [
  { label: "expanded", code: true, defaultExpanded: true },
  { label: "collapsed", code: true, defaultExpanded: false },
];

const ARROW_POSITIONS: {
  label: string;
  code: true;
  arrowPosition: DisclosureTriggerProps["arrowPosition"];
}[] = [
  { label: "start", code: true, arrowPosition: "start" },
  { label: "end", code: true, arrowPosition: "end" },
  { label: "none", code: true, arrowPosition: "none" },
];

export const ArrowPositions: StoryFn = () => (
  <OptionGrid
    rows={ARROW_POSITIONS}
    columns={EXPANSION}
    renderCell={(row, column) => (
      <Frame>
        <Item
          id="attributes"
          title="Attributes"
          defaultExpanded={column?.defaultExpanded}
          triggerProps={{ arrowPosition: row.arrowPosition }}
        />
      </Frame>
    )}
  />
);
ArrowPositions.storyName = "Arrow Positions";
ArrowPositions.tags = ["!dev"];
ArrowPositions.parameters = { themeLayout: "column" };

const STATES: { label: string; props: Partial<DisclosureProps> }[] = [
  { label: "Default", props: {} },
  { label: "Disabled", props: { isDisabled: true } },
];

export const States: StoryFn = () => (
  <OptionGrid
    rows={STATES}
    columns={EXPANSION}
    renderCell={(row, column) => (
      <Frame>
        <Item
          id="attributes"
          title="Attributes"
          defaultExpanded={column?.defaultExpanded}
          {...row.props}
        />
      </Frame>
    )}
  />
);
States.tags = ["!dev"];
States.parameters = { themeLayout: "column" };

const SIZES = (["S", "M", "L"] as const).map((size) => ({
  label: size,
  code: true,
  size,
}));

const SIZE_OWNERS = [
  { label: "DisclosureGroup size", code: true, owner: "group" },
  { label: "Disclosure size", code: true, owner: "disclosure" },
] as const;

/**
 * Size is styled in two places only: `S` on a `DisclosureGroup` tightens its
 * triggers' padding, and `L` on a `Disclosure` gives its trigger a fixed,
 * taller height. Every other combination renders at the default size.
 */
export const Sizes: StoryFn = () => (
  <OptionGrid
    rows={SIZES}
    columns={SIZE_OWNERS}
    renderCell={(row, column) => (
      <Frame>
        <DisclosureGroup
          size={column?.owner === "group" ? row.size : undefined}
        >
          {["Attributes", "Events"].map((title) => (
            <Item
              key={title}
              id={title}
              title={title}
              size={column?.owner === "disclosure" ? row.size : undefined}
            />
          ))}
        </DisclosureGroup>
      </Frame>
    )}
  />
);
Sizes.tags = ["!dev"];
Sizes.parameters = { themeLayout: "column" };

const TRIGGER_LAYOUTS: {
  label: string;
  code: true;
  props: Omit<DisclosureTriggerProps, "children">;
  title: ReactNode;
}[] = [
  {
    label: 'justifyContent="start"',
    code: true,
    props: { justifyContent: "start" },
    title: (
      <>
        Annotations
        <Counter variant="quiet">4</Counter>
      </>
    ),
  },
  {
    label: 'justifyContent="space-between"',
    code: true,
    props: { justifyContent: "space-between" },
    title: (
      <>
        Annotations
        <Counter variant="quiet">4</Counter>
      </>
    ),
  },
  {
    label: 'direction="column"',
    code: true,
    props: { direction: "column", alignItems: "start" },
    title: (
      <>
        <Text weight="heavy">Reasoning</Text>
        <Text size="XS" color="text-700">
          1,204 tokens
        </Text>
      </>
    ),
  },
];

export const TriggerLayouts: StoryFn = () => (
  <OptionGrid
    rows={TRIGGER_LAYOUTS}
    renderCell={(row) => (
      <Frame>
        <Item
          id="trigger"
          title={row.title}
          defaultExpanded={false}
          triggerProps={row.props}
        />
      </Frame>
    )}
  />
);
TriggerLayouts.storyName = "Trigger Layouts";
TriggerLayouts.tags = ["!dev"];
TriggerLayouts.parameters = { themeLayout: "column" };

const GROUP_MODES: {
  label: string;
  code: true;
  props: Partial<DisclosureGroupProps>;
}[] = [
  {
    label: "allowsMultipleExpanded",
    code: true,
    props: { defaultExpandedKeys: ["input", "output"] },
  },
  {
    label: "allowsMultipleExpanded={false}",
    code: true,
    props: { allowsMultipleExpanded: false, defaultExpandedKeys: ["input"] },
  },
];

export const GroupExpansion: StoryFn = () => (
  <OptionGrid
    columns={GROUP_MODES}
    renderCell={(_, column) => (
      <Frame>
        <DisclosureGroup {...column?.props}>
          {["Input", "Output", "Metadata"].map((title) => (
            <Item key={title} id={title.toLowerCase()} title={title} />
          ))}
        </DisclosureGroup>
      </Frame>
    )}
  />
);
GroupExpansion.storyName = "Group Expansion";
GroupExpansion.tags = ["!dev"];
GroupExpansion.parameters = { themeLayout: "column" };

const ARROW_ROWS = (["start", "end"] as const).map((position) => ({
  label: position,
  code: true,
  position,
}));

const ARROW_COLUMNS = [
  { label: "collapsed", code: true, isExpanded: false },
  { label: "expanded", code: true, isExpanded: true },
];

export const Arrow: StoryFn = () => (
  <OptionGrid
    rows={ARROW_ROWS}
    columns={ARROW_COLUMNS}
    renderCell={(row, column) => (
      <Flex direction="row" gap="size-100" alignItems="center">
        {row.position === "start" ? (
          <DisclosureArrow position="start" isExpanded={!!column?.isExpanded} />
        ) : null}
        <Text>Section title</Text>
        {row.position === "end" ? (
          <DisclosureArrow position="end" isExpanded={!!column?.isExpanded} />
        ) : null}
      </Flex>
    )}
  />
);
Arrow.tags = ["!dev"];
Arrow.parameters = { themeLayout: "row" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <View width="100%">
      <DisclosureGroup defaultExpandedKeys={["first"]}>
        <Disclosure id="first">
          <DisclosureTrigger>First section</DisclosureTrigger>
          <DisclosurePanel>
            <Text>Expanded content</Text>
          </DisclosurePanel>
        </Disclosure>
        <Disclosure id="second">
          <DisclosureTrigger>Second section</DisclosureTrigger>
          <DisclosurePanel>
            <Text>Collapsed content</Text>
          </DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
    </View>
  ),
};
