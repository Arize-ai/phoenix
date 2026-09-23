import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import type { TagGroupProps } from "@phoenix/components";
import { Label, Tag, TagGroup, TagList } from "@phoenix/components";

const meta: Meta = {
  title: "Design System/Forms/Tag Group",
  tags: ["legacy", "unreviewed"],
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
  <TagGroup {...args}>
    <Label>Categories</Label>
    <TagList>
      <Tag>News</Tag>
      <Tag>Travel</Tag>
      <Tag>Gaming</Tag>
      <Tag>Shopping</Tag>
    </TagList>
  </TagGroup>
);

export const Default = {
  tags: ["!dev"],
  render: Template,

  args: {
    selectionMode: "multiple",
  },
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj<TagGroupProps> = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <TagGroup selectionMode="multiple" defaultSelectedKeys={["news", "gaming"]}>
      <Label>Categories</Label>
      <TagList>
        <Tag id="news">News</Tag>
        <Tag id="travel">Travel</Tag>
        <Tag id="gaming">Gaming</Tag>
        <Tag id="shopping">Shopping</Tag>
      </TagList>
    </TagGroup>
  ),
};
