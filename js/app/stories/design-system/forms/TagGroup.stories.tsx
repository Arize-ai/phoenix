import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import type { TagGroupProps } from "@phoenix/components";
import { Label, Tag, TagGroup, TagList } from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A labeled group of tags. `selectionMode` decides whether the tags are
 * static labels (`none`), a pick-one choice (`single`), or a pick-many filter
 * (`multiple`).
 */
const meta: Meta = {
  title: "Design System/Forms/Tag Group",
  tags: ["unused", "updated", "unreviewed", "incomplete"],
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
  label: string;
  mode: NonNullable<TagGroupProps["selectionMode"]>;
  defaultSelectedKeys?: string[];
}[] = [
  { label: "Not selectable", mode: "none" },
  {
    label: "Single select",
    mode: "single",
    defaultSelectedKeys: ["travel"],
  },
  {
    label: "Multi select",
    mode: "multiple",
    defaultSelectedKeys: ["news", "gaming"],
  },
];

/**
 * Each selection mode, starting from a representative selection. The tags
 * stay interactive, so selecting and deselecting can be tried in each mode.
 */
export const SelectionModes: StoryFn = () => (
  <OptionGrid
    rows={MODES}
    renderCell={({ mode, defaultSelectedKeys }) => (
      <Categories
        selectionMode={mode}
        defaultSelectedKeys={defaultSelectedKeys}
      />
    )}
  />
);
SelectionModes.parameters = { themeLayout: "column" };
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
