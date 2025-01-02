import React from "react";
import { Meta, StoryFn } from "@storybook/react";

// eslint-disable-next-line deprecate/import
import {
  Accordion as LegacyAccordion,
  AccordionItem as LegacyAccordionItem,
} from "@arizeai/components";

import {
  Disclosure,
  DisclosureGroup,
  type DisclosureGroupProps,
  DisclosurePanel,
  DisclosureProps,
  DisclosureTrigger,
  Flex,
  Heading,
  Text,
  View,
} from "@phoenix/components";

import { ThemeWrapper } from "./components/ThemeWrapper";

const meta: Meta = {
  title: "Disclosure",
};

export default meta;

const Template: StoryFn<DisclosureGroupProps> = (args) => (
  <ThemeWrapper>
    <View height="600px" width="300px">
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
  </ThemeWrapper>
);

export const Default: Meta<typeof DisclosureGroup> = {
  render: Template,
  args: { allowsMultipleExpanded: false, isDisabled: false },
};

const SingleItemStory: StoryFn<DisclosureProps> = (args) => (
  <ThemeWrapper>
    <View height="600px" width="300px">
      <Disclosure id="content" {...args}>
        <DisclosureTrigger>Content Title</DisclosureTrigger>
        <DisclosurePanel>
          <Text>Content</Text>
        </DisclosurePanel>
      </Disclosure>
    </View>
  </ThemeWrapper>
);

export const SingleItem: Meta<typeof SingleItemStory> = {
  render: SingleItemStory,
  args: { defaultExpanded: true, isExpanded: undefined, isDisabled: false },
  argTypes: {
    isExpanded: {
      control: { type: "boolean" },
    },
  },
};

const MigrationStory: StoryFn<DisclosureGroupProps> = (args) => (
  <ThemeWrapper>
    <View height="600px">
      <Flex direction="column" gap="size-400" alignItems="baseline">
        <Heading level={2}>Disclosure</Heading>
        <DisclosureGroup {...args}>
          <Disclosure id="content" defaultExpanded>
            <DisclosureTrigger>Content Title</DisclosureTrigger>
            <DisclosurePanel>
              <Text>Content</Text>
            </DisclosurePanel>
          </Disclosure>
          <Disclosure id="content-2">
            <DisclosureTrigger>Content Title 2</DisclosureTrigger>
            <DisclosurePanel>
              <Text>Content 2</Text>
            </DisclosurePanel>
          </Disclosure>
        </DisclosureGroup>
        <Heading level={2}>Legacy Accordion</Heading>
        <LegacyAccordion>
          <LegacyAccordionItem
            id="content-legacy"
            title={"Content Legacy Title"}
          >
            <Text>Content Legacy</Text>
          </LegacyAccordionItem>
          <LegacyAccordionItem
            id="content-legacy-2"
            title={"Content Legacy Title 2"}
          >
            <Text>Content Legacy 2</Text>
          </LegacyAccordionItem>
        </LegacyAccordion>
      </Flex>
    </View>
  </ThemeWrapper>
);
export const Migration: Meta<typeof MigrationStory> = {
  render: MigrationStory,
  args: {
    allowsMultipleExpanded: true,
    isDisabled: false,
    defaultExpandedKeys: ["content", "content-2"],
  },
};
