import { Meta, StoryFn } from "@storybook/react";

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
