import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";
import { useState } from "react";
import {
  Button,
  type Key,
  type Selection,
  Tree,
  TreeItem,
  TreeItemContent,
} from "react-aria-components";

const meta: Meta = {
  title: "Tree View/Primitive Tree",
  parameters: {
    layout: "centered",
  },
};

export default meta;

const PARENTS = ["One", "Two", "Three"];

// ponytail: lean on react-aria-components Tree for the ARIA tree pattern +
// keyboard (single tab stop / roving tabindex, Up/Down/Home/End, Left/Right
// to collapse/expand) and the slot="chevron" button. No wrapper component yet —
// extract one when the span, trace, or session views actually consume it.
const treeCSS = css`
  border: 1px solid var(--global-border-color-default);

  & [role="row"] {
    display: flex;
    align-items: center;
    outline: none;
    background: var(--global-card-header-background-color);
  }
  /* pad the label/content area, separate from the chevron; fill the row so a
     click anywhere left of the chevron registers */
  & .row-label {
    flex: 1;
    padding: var(--global-dimension-size-100);
  }
  /* pale hover */
  & [role="row"][data-hovered] {
    background: var(--global-card-header-background-color-hover);
  }
  /* darker selected, plus bold */
  & [role="row"][data-selected] {
    background: var(--global-list-item-selected-background-color);
    font-weight: bold;
  }
  /* hovering a selected row still shows hover bg */
  & [role="row"][data-selected][data-hovered] {
    background: var(--global-card-header-background-color-hover);
  }
  /* keyboard focus */
  & [role="row"][data-focus-visible] {
    outline: 1px solid var(--global-color-primary);
    outline-offset: -1px;
  }
  /* clickable expansion button, flush against the row's right edge */
  & [slot="chevron"] {
    margin-left: auto;
    align-self: stretch;
    padding: var(--global-dimension-size-100);
    cursor: pointer;
    border: none;
    background: var(--global-input-field-background-color);
  }
  & [slot="chevron"][data-hovered] {
    background: var(--global-input-field-background-color-hover);
  }
`;

/** The most primitive tree: bare divs, raw text, keyboard + mouse navigable. */
export const PrimitiveTree: StoryFn = () => {
  const [selected, setSelected] = useState<Selection>(new Set<Key>());
  const [expanded, setExpanded] = useState<Set<Key>>(new Set());

  const toggleExpanded = (key: Key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // First press selects; pressing the row when it's already selected toggles its
  // expansion. `selected` here is the pre-press value, so the initial selecting
  // press is a no-op for expansion.
  const onParentPressStart = (key: Key) => {
    if (selected instanceof Set && selected.has(key)) toggleExpanded(key);
  };

  return (
    <Tree
      aria-label="Primitive tree"
      selectionMode="single"
      disallowEmptySelection
      css={treeCSS}
      selectedKeys={selected}
      onSelectionChange={setSelected}
      expandedKeys={expanded}
      onExpandedChange={(keys) => setExpanded(new Set(keys))}
    >
      {PARENTS.map((label) => (
        <TreeItem
          key={label}
          id={label}
          textValue={label}
          onPressStart={() => onParentPressStart(label)}
        >
          <TreeItemContent>
            {({ isExpanded }) => (
              <>
                <span className="row-label">{label}</span>
                <Button
                  slot="chevron"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? "▾" : "▸"}
                </Button>
              </>
            )}
          </TreeItemContent>
          {["A", "B", "C"].map((child) => (
            <TreeItem
              key={`${label}-${child}`}
              id={`${label}-${child}`}
              textValue={child}
            >
              <TreeItemContent>
                <span className="row-label">{child}</span>
              </TreeItemContent>
            </TreeItem>
          ))}
        </TreeItem>
      ))}
    </Tree>
  );
};
