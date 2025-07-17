import { Meta, StoryFn } from "@storybook/react";

import {
  Item as LegacyItem,
  ListBox as LegacyListBox,
} from "@arizeai/components";

import { ListBox, ListBoxItem, ListBoxProps } from "@phoenix/components";

const meta: Meta = {
  title: "ListBox",
  component: ListBox,
};

export default meta;

const Template: StoryFn<Omit<ListBoxProps<object>, "children">> = (props) => (
  <ListBox aria-label="Favorite animal" {...props}>
    <ListBoxItem>Aardvark</ListBoxItem>
    <ListBoxItem>Cat</ListBoxItem>
    <ListBoxItem>Dog</ListBoxItem>
    <ListBoxItem>Kangaroo</ListBoxItem>
    <ListBoxItem>Panda</ListBoxItem>
    <ListBoxItem>Snake</ListBoxItem>
  </ListBox>
);

export const Default = Template.bind({});

Default.args = {
  selectionMode: "single",
};

export const Legacy = () => (
  <LegacyListBox aria-label="Favorite animal">
    <LegacyItem>Aardvark</LegacyItem>
    <LegacyItem>Cat</LegacyItem>
    <LegacyItem>Dog</LegacyItem>
    <LegacyItem>Kangaroo</LegacyItem>
    <LegacyItem>Panda</LegacyItem>
    <LegacyItem>Snake</LegacyItem>
  </LegacyListBox>
);
