import { Meta, StoryFn } from "@storybook/react";

import {
  Label,
  Tag,
  TagGroup,
  TagGroupProps,
  TagList,
} from "@phoenix/components";

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

export const Default = Template.bind({});

Default.args = {
  selectionMode: "multiple",
};
