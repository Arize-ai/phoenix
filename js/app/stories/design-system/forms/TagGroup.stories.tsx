import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import type { TagGroupProps } from "@phoenix/components";
import { Flex, Label, Tag, TagGroup, TagList, Text } from "@phoenix/components";

/**
 * A labeled group of tags. `selectionMode` decides whether the tags are
 * static labels (`none`), a pick-one choice (`single`), or a pick-many filter
 * (`multiple`). The three modes are stacked in one gallery so they can be
 * compared at a glance rather than switched through a control.
 */
const meta: Meta = {
  title: "Design System/Forms/Tag Group",
  tags: ["updated", "unreviewed", "incomplete"],
  component: TagGroup,
};

export default meta;

const CATEGORIES = [
  { id: "news", name: "News" },
  { id: "travel", name: "Travel" },
  { id: "gaming", name: "Gaming" },
  { id: "shopping", name: "Shopping" },
];

function Categories(props: Omit<TagGroupProps, "children">) {
  return (
    <TagGroup {...props}>
      <Label>Categories</Label>
      <TagList>
        {CATEGORIES.map(({ id, name }) => (
          <Tag key={id} id={id}>
            {name}
          </Tag>
        ))}
      </TagList>
    </TagGroup>
  );
}

const MODES: {
  mode: NonNullable<TagGroupProps["selectionMode"]>;
  description: string;
  defaultSelectedKeys?: string[];
}[] = [
  { mode: "none", description: "static labels; tags cannot be selected" },
  {
    mode: "single",
    description: "at most one tag is selected",
    defaultSelectedKeys: ["travel"],
  },
  {
    mode: "multiple",
    description: "any number of tags are selected",
    defaultSelectedKeys: ["news", "gaming"],
  },
];

/**
 * Each selection mode, starting from a representative selection. The tags
 * stay interactive, so selecting and deselecting can be tried in each mode.
 */
export const SelectionModes: StoryFn = () => (
  <Flex direction="column" gap="size-300">
    {MODES.map(({ mode, description, defaultSelectedKeys }) => (
      <Flex key={mode} direction="column" gap="size-100">
        <Text size="S" color="text-700" fontFamily="mono">
          selectionMode=&quot;{mode}&quot; — {description}
        </Text>
        <Categories
          selectionMode={mode}
          defaultSelectedKeys={defaultSelectedKeys}
        />
      </Flex>
    ))}
  </Flex>
);
SelectionModes.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj<TagGroupProps> = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <Categories
      selectionMode="multiple"
      defaultSelectedKeys={["news", "gaming"]}
    />
  ),
};
