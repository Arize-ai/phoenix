import React from "react";
import { Meta, StoryFn } from "@storybook/react";

import {
  Label,
  Tag,
  TagGroup,
  TagGroupProps,
  TagList,
} from "@phoenix/components";

import { ThemeWrapper } from "./components/ThemeWrapper";

const meta: Meta = {
  title: "TagGroup",
  component: TagGroup,
  parameters: {
    controls: { expanded: true },
  },
  argTypes: {
    selectionMode: {
      options: ["none", "single", "multiple"],
      control: {
        type: "radio",
      },
    },
  },
};

export default meta;

const Template: StoryFn<TagGroupProps> = (args) => (
  <ThemeWrapper>
    <TagGroup {...args}>
      <Label>Categories</Label>
      <TagList>
        <Tag>News</Tag>
        <Tag>Travel</Tag>
        <Tag>Gaming</Tag>
        <Tag>Shopping</Tag>
      </TagList>
    </TagGroup>
  </ThemeWrapper>
);

export const Default = Template.bind({});

Default.args = {
  selectionMode: "multiple",
};
