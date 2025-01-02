import React from "react";
import { Meta, StoryFn } from "@storybook/react";

import { Label, Tag, TagGroup, TagList, TagProps } from "@phoenix/components";

import { ThemeWrapper } from "./components/ThemeWrapper";

const meta: Meta = {
  title: "TagGroup",
  component: Tag,
  parameters: {
    controls: { expanded: true },
  },
};

export default meta;

const Template: StoryFn<TagProps> = (args) => (
  <ThemeWrapper>
    <TagGroup selectionMode="multiple">
      <Label>Categories</Label>
      <TagList>
        <Tag {...args}>News</Tag>
        <Tag {...args}>Travel</Tag>
        <Tag {...args}>Gaming</Tag>
        <Tag {...args}>Shopping</Tag>
      </TagList>
    </TagGroup>
  </ThemeWrapper>
);

export const Default = Template.bind({});

Default.args = {
  children: "Button",
};
