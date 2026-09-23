import type { Meta, StoryFn } from "@storybook/react";

import type { ListBoxProps } from "@phoenix/components";
import { ListBox, ListBoxItem } from "@phoenix/components";

const meta: Meta = {
  title: "Design System/Navigation/List Box",
  tags: ["legacy", "unreviewed"],
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

export const Default = {
  tags: ["!dev"],
  render: Template,

  args: {
    selectionMode: "single",
  },
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <ListBox
      aria-label="Favorite animal"
      selectionMode="single"
      defaultSelectedKeys={["cat"]}
      style={{ width: 200 }}
    >
      <ListBoxItem id="aardvark">Aardvark</ListBoxItem>
      <ListBoxItem id="cat">Cat</ListBoxItem>
      <ListBoxItem id="dog">Dog</ListBoxItem>
      <ListBoxItem id="kangaroo">Kangaroo</ListBoxItem>
    </ListBox>
  ),
};
