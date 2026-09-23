import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import { useState } from "react";

import {
  type DisclosureArrowProps,
  type DisclosureProps,
  type DisclosureTriggerProps,
  Card,
  Disclosure,
  DisclosureArrow,
  DisclosureGroup,
  type DisclosureGroupProps,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Text,
  View,
} from "@phoenix/components";

/**
 * A disclosure shows and hides a section of content under a trigger.
 * `DisclosureGroup` coordinates several disclosures as an accordion, and
 * `Disclosure`, `DisclosureTrigger` and `DisclosurePanel` build each item.
 *
 * Every disclosure surface in Phoenix — cards, accordions, table row
 * expanders, trees, collapsible panels — marks its state with the same part,
 * `DisclosureArrow`, a rotating chevron. The `Arrow` stories document that
 * part on its own for surfaces that render it outside a `DisclosureTrigger`.
 */
const meta: Meta = {
  title: "Design System/Layout/Disclosure",
  tags: ["legacy", "unreviewed"],
  component: DisclosureGroup,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<DisclosureGroupProps> = (args) => (
  <Card title="Disclosure">
    <View width="600px">
      <DisclosureGroup {...args}>
        <Disclosure id="content">
          <DisclosureTrigger>First Item Title</DisclosureTrigger>
          <DisclosurePanel>
            <Text>First Item Content</Text>
          </DisclosurePanel>
        </Disclosure>
        <Disclosure id="content-2">
          <DisclosureTrigger>Second Item Title</DisclosureTrigger>
          <DisclosurePanel>
            <Text>Second Item Content</Text>
          </DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
    </View>
  </Card>
);

export const Default: Meta<typeof DisclosureGroup> = {
  render: Template,
  args: { allowsMultipleExpanded: false, isDisabled: false },
};

const SingleItemStory: StoryFn<DisclosureProps> = (args) => (
  <Disclosure id="content" {...args}>
    <DisclosureTrigger>Content Title</DisclosureTrigger>
    <DisclosurePanel>
      <Text>Content</Text>
    </DisclosurePanel>
  </Disclosure>
);

export const SingleItem = SingleItemStory.bind({
  args: {
    defaultExpanded: true,
    isExpanded: undefined,
    isDisabled: false,
    size: "L",
  },
  argTypes: {
    isExpanded: {
      control: { type: "boolean" },
    },
    size: {
      control: { type: "radio" },
      options: ["M", "L"],
    },
  },
});

const ExtraTitleContentStory: StoryFn<DisclosureTriggerProps> = (args) => (
  <Card title="Disclosure">
    <View width="600px">
      <DisclosureGroup>
        <Disclosure id="content" {...args}>
          <DisclosureTrigger {...args}>
            Content Title
            <span
              style={{
                color: "var(--global-text-color-500)",
                border: "1px solid var(--global-text-color-500)",
                borderRadius: "12px",
                padding: "var(--global-dimension-size-100)",
                height: "8px",
                width: "16px",
                lineHeight: "0px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              1
            </span>
          </DisclosureTrigger>
          <DisclosurePanel>
            <Text>Content</Text>
          </DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
    </View>
  </Card>
);

export const ExtraTitleContent = ExtraTitleContentStory.bind({
  args: {
    justifyContent: "start",
    arrowPosition: "end",
  },
  argTypes: {
    arrowPosition: {
      control: { type: "radio" },
      options: ["start", "end"],
    },
    justifyContent: {
      control: { type: "radio" },
      options: ["space-between", "start"],
    },
  },
});

const ArrowTemplate: StoryFn<DisclosureArrowProps> = (args) => (
  <View padding="size-200">
    <Flex direction="row" gap="size-100" alignItems="center">
      <DisclosureArrow {...args} />
      <Text>Section Title</Text>
    </Flex>
  </View>
);

type ArrowStory = StoryObj<typeof DisclosureArrow>;

const arrowArgTypes: ArrowStory["argTypes"] = {
  position: {
    control: { type: "radio" },
    options: ["start", "end"],
  },
};

/**
 * `DisclosureArrow`, the canonical collapse / expand affordance. Rotates
 * right → down when placed at the start of a label.
 */
export const ArrowStartPosition: ArrowStory = {
  name: "Arrow",
  render: ArrowTemplate,
  args: { isExpanded: false, position: "start" },
  argTypes: arrowArgTypes,
};

/**
 * End-positioned arrows (right side of a trigger) rotate down → up.
 */
export const ArrowEndPosition: ArrowStory = {
  name: "Arrow End Position",
  render: ArrowTemplate,
  args: { isExpanded: false, position: "end" },
  argTypes: arrowArgTypes,
};

const ArrowInteractiveStory: StoryFn<DisclosureArrowProps> = (args) => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <button
      className="button--reset"
      onClick={() => setIsExpanded(!isExpanded)}
      style={{ cursor: "pointer" }}
      aria-expanded={isExpanded}
    >
      <Flex direction="row" gap="size-100" alignItems="center">
        <DisclosureArrow {...args} isExpanded={isExpanded} />
        <Text>Click to toggle</Text>
      </Flex>
    </button>
  );
};

export const ArrowInteractive: ArrowStory = {
  name: "Arrow Interactive",
  render: ArrowInteractiveStory,
  args: { position: "start" },
  argTypes: arrowArgTypes,
};

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
