import { Meta, StoryFn } from "@storybook/react";

import { Card } from "@arizeai/components";

import {
  Disclosure,
  DisclosureGroup,
  type DisclosureGroupProps,
  DisclosurePanel,
  DisclosureProps,
  DisclosureTrigger,
  DisclosureTriggerProps,
  Text,
} from "@phoenix/components";

const meta: Meta = {
  title: "Disclosure",
  component: DisclosureGroup,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<DisclosureGroupProps> = (args) => (
  <Card
    title="Disclosure"
    bodyStyle={{ padding: 0, width: "600px" }}
    variant="compact"
  >
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

export const SingleItem: Meta<typeof SingleItemStory> = {
  render: SingleItemStory,
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
};

const ExtraTitleContentStory: StoryFn<DisclosureTriggerProps> = (args) => (
  <Card
    title="Disclosure"
    bodyStyle={{ padding: 0, width: "600px" }}
    variant="compact"
  >
    <DisclosureGroup>
      <Disclosure id="content" {...args}>
        <DisclosureTrigger {...args}>
          Content Title
          <span
            style={{
              color: "var(--ac-global-text-color-500)",
              border: "1px solid var(--ac-global-text-color-500)",
              borderRadius: "12px",
              padding: "var(--ac-global-dimension-static-size-100)",
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
  </Card>
);

export const ExtraTitleContent: Meta<typeof ExtraTitleContentStory> = {
  render: ExtraTitleContentStory,
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
};
