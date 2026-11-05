import { css } from "@emotion/react";
import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { fn } from "storybook/test";

import type { FamilySize, TagGroupItem } from "@phoenix/components/core/v2";
import { Tag, TagGroup as TagGroupV2 } from "@phoenix/components/core/v2";

import { HeldOpenCell } from "../../../utils/HeldOpenCell";
import { OptionGrid } from "../../../utils/OptionGrid";

/**
 * The set of Tags attached to one thing. It owns their layout, overflow,
 * keyboard navigation, selection and removal, so no surface lays tags out in
 * a row of its own.
 *
 * The surface picks the interaction, and the same set can be read-only on
 * one surface and editable on another:
 *
 * - **Read-only**: a plain list. Nothing is focusable.
 * - **Operational**: `onAction`. Each tag does one thing, such as opening
 *   the labelled prompts. An item with an `href` is a link to the object's
 *   page instead, so it opens in a new tab and copies as a link.
 * - **Selectable**: `selectionMode`. The tags toggle membership in a set, as
 *   a filter does. A selectable tag never also navigates, so `onAction` and
 *   `selectionMode` cannot be combined.
 * - **Removable**: `onRemove`, alone or with either of the above. Delete or
 *   Backspace removes the focused tag and focus moves to the next one.
 *
 * Interactive sets are one tab stop; the arrow keys move between tags.
 *
 * `overflow="wrap"` lays every tag out on as many rows as it needs, for
 * detail pages and editors. `overflow="collapse"` keeps one row and adds a
 * `+N` button that opens the rest in a popover; prefer it in tables over
 * truncating every tag. With a `limit` it shows that many tags; without one
 * it shows as many as fit, fills its container's width, and recounts as
 * the width changes, which suits a resizable table column. `itemMaxWidth` truncates a long name
 * and makes the full name its tooltip; the remove button is never
 * truncated.
 *
 * Tags show in the order given: the person's own order, else alphabetical,
 * and stable from one render to the next. An empty set renders nothing;
 * where the set is being edited, the way to add a tag sits beside the group.
 */
const meta: Meta = {
  title: "Design System/Badges/V2/Tag Group",
  component: TagGroupV2,
  subcomponents: { Tag },
  tags: ["updated", "unreviewed", "incomplete", "unused"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const LABELS: TagGroupItem[] = [
  { id: "production", label: "Production", color: "green" },
  { id: "staging", label: "Staging", color: "cyan" },
  { id: "needs-review", label: "Needs review", color: "purple" },
  { id: "regression", label: "Regression", color: "magenta" },
  { id: "v3", label: "v3" },
];

const MANY_LABELS: TagGroupItem[] = Array.from({ length: 25 }, (_, index) => ({
  id: `label-${index + 1}`,
  label: `Label ${String(index + 1).padStart(2, "0")}`,
}));

const LONG_LABELS: TagGroupItem[] = [
  { id: "short", label: "v3" },
  { id: "regular", label: "Production" },
  {
    id: "long",
    label: "Candidate for release after review",
    color: "purple",
  },
];

const SIZES: { label: FamilySize; code: true }[] = [
  { label: "S", code: true },
  { label: "M", code: true },
];

const OVERFLOWS: {
  label: string;
  code?: true;
  render: (items: TagGroupItem[]) => ReactNode;
}[] = [
  {
    label: "wrap",
    code: true,
    render: (items) => <TagGroupV2 aria-label="Labels" items={items} />,
  },
  {
    label: "collapse · limit 2",
    code: true,
    render: (items) => (
      <TagGroupV2
        aria-label="Labels"
        items={items}
        overflow="collapse"
        limit={2}
      />
    ),
  },
  {
    label: "collapse · fit",
    code: true,
    render: (items) => (
      <TagGroupV2 aria-label="Labels" items={items} overflow="collapse" />
    ),
  },
];

const PROJECTS = [
  { id: "default", label: "default", href: "/projects/UHJvamVjdDox" },
  { id: "chatbot", label: "chatbot-prod", href: "/projects/UHJvamVjdDoy" },
  { id: "rag", label: "rag-eval", href: "/projects/UHJvamVjdDoz" },
];

const LINK_INTERACTIONS: {
  label: string;
  render: () => ReactNode;
}[] = [
  {
    label: "Links",
    render: () => <TagGroupV2 aria-label="Projects" items={PROJECTS} />,
  },
  {
    label: "Links, removable",
    render: () => (
      <TagGroupV2 aria-label="Projects" items={PROJECTS} onRemove={fn()} />
    ),
  },
];

const COUNTS: { label: string; items: TagGroupItem[] }[] = [
  { label: "None", items: [] },
  { label: "1", items: LABELS.slice(0, 1) },
  { label: "5", items: LABELS },
  { label: "25 items", items: MANY_LABELS },
];

const ITEM_MAX_WIDTHS: { label: string; code?: true; value?: string }[] = [
  { label: "Default" },
  { label: "80px", code: true, value: "80px" },
];

const ITEM_STATES: { label: string; items: TagGroupItem[] }[] = [
  { label: "Enabled", items: LABELS.slice(0, 3) },
  {
    label: "One tag disabled",
    items: LABELS.slice(0, 3).map((item) =>
      item.id === "staging" ? { ...item, isDisabled: true } : item
    ),
  },
];

const constrainedCSS = css`
  width: 180px;
  border-inline-end: 1px dashed var(--global-border-color-default);
`;

function RemovableTagGroup({
  initialItems,
  isSelectable,
}: {
  initialItems: TagGroupItem[];
  isSelectable?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const onRemove = (ids: Set<string>) =>
    setItems((current) => current.filter((item) => !ids.has(item.id)));
  return isSelectable ? (
    <TagGroupV2
      aria-label="Labels"
      items={items}
      onRemove={onRemove}
      selectionMode="multiple"
      defaultSelectedKeys={["staging"]}
    />
  ) : (
    <TagGroupV2 aria-label="Labels" items={items} onRemove={onRemove} />
  );
}

const INTERACTIONS: {
  label: string;
  render: (items: TagGroupItem[]) => ReactNode;
}[] = [
  {
    label: "Read-only",
    render: (items) => <TagGroupV2 aria-label="Labels" items={items} />,
  },
  {
    label: "Operational",
    render: (items) => (
      <TagGroupV2 aria-label="Labels" items={items} onAction={fn()} />
    ),
  },
  {
    label: "Single select",
    render: (items) => (
      <TagGroupV2
        aria-label="Labels"
        items={items}
        selectionMode="single"
        defaultSelectedKeys={["staging"]}
      />
    ),
  },
  {
    label: "Multi select",
    render: (items) => (
      <TagGroupV2
        aria-label="Labels"
        items={items}
        selectionMode="multiple"
        defaultSelectedKeys={["production", "staging"]}
      />
    ),
  },
  {
    label: "Removable",
    render: (items) => <RemovableTagGroup initialItems={items} />,
  },
  {
    label: "Removable, multi select",
    render: (items) => <RemovableTagGroup initialItems={items} isSelectable />,
  },
];

export const Default: StoryFn = () => (
  <TagGroupV2 aria-label="Labels" items={LABELS.slice(0, 3)} />
);
Default.tags = ["!dev"];

export const InteractionsAndStates: StoryFn = () => (
  <OptionGrid
    rows={INTERACTIONS}
    columns={ITEM_STATES}
    renderCell={(interaction, state) => interaction.render(state?.items ?? [])}
  />
);
InteractionsAndStates.tags = ["!dev"];
InteractionsAndStates.parameters = { themeLayout: "column" };

export const OverflowAndItemCount: StoryFn = () => (
  <OptionGrid
    rows={OVERFLOWS}
    columns={COUNTS}
    alignRows="start"
    renderCell={(overflow, count) => (
      <div css={constrainedCSS}>{overflow.render(count?.items ?? [])}</div>
    )}
  />
);
OverflowAndItemCount.tags = ["!dev"];
OverflowAndItemCount.parameters = { themeLayout: "column" };

export const Links: StoryFn = () => (
  <OptionGrid
    rows={LINK_INTERACTIONS}
    renderCell={(interaction) => interaction.render()}
  />
);
Links.tags = ["!dev"];
Links.parameters = { themeLayout: "column" };

export const Sizes: StoryFn = () => (
  <OptionGrid
    rows={SIZES}
    renderCell={(size) => (
      <TagGroupV2
        aria-label="Labels"
        items={LABELS}
        overflow="collapse"
        limit={3}
        size={size.label}
        onRemove={fn()}
      />
    )}
  />
);
Sizes.tags = ["!dev"];
Sizes.parameters = { themeLayout: "column" };

export const ContentLength: StoryFn = () => (
  <OptionGrid
    rows={ITEM_MAX_WIDTHS}
    renderCell={(maxWidth) => (
      <TagGroupV2
        aria-label="Labels"
        items={LONG_LABELS}
        itemMaxWidth={maxWidth.value}
        onRemove={fn()}
      />
    )}
  />
);
ContentLength.tags = ["!dev"];
ContentLength.parameters = { themeLayout: "column" };

/**
 * The `+N` popover lists the hidden tags with the same interaction as the
 * visible ones, here removable. It is a non-modal popover: the page behind
 * it stays usable, and a press outside it closes it.
 */
export const OverflowPopover: StoryObj = {
  tags: ["!dev"],
  parameters: {
    themeLayout: "row",
    docs: { story: { inline: false, height: "240px" } },
  },
  render: () => (
    <HeldOpenCell width={280} height={180}>
      {(boundaryElement) => (
        <TagGroupV2
          aria-label="Labels"
          items={LABELS}
          overflow="collapse"
          limit={2}
          onRemove={fn()}
          isOverflowOpen
          onOverflowOpenChange={() => {}}
          overflowBoundaryElement={boundaryElement}
        />
      )}
    </HeldOpenCell>
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ width: 300 }}>
      <TagGroupV2
        aria-label="Labels"
        items={LABELS}
        size="M"
        overflow="collapse"
        limit={3}
      />
    </div>
  ),
};
