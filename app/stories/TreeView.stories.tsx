import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";
import { Tree, TreeItem, TreeItemContent } from "react-aria-components";

const meta: Meta = {
  title: "Tree View/Primitive Tree",
  parameters: {
    layout: "centered",
  },
};

export default meta;

// ponytail: lean on react-aria-components Tree for the ARIA tree pattern +
// keyboard (single tab stop / roving tabindex, Up/Down/Home/End, Left/Right
// to collapse/expand). No wrapper component yet — extract one when the span,
// trace, or session views actually consume it.
const treeCSS = css`
  border: 1px solid var(--global-border-color-default);

  & [role="treeitem"] {
    outline: none;
  }
  /* mouse interactivity */
  & [role="treeitem"][data-hovered] {
    background: var(--global-list-item-hover-background-color);
  }
  /* keyboard interactivity */
  & [role="treeitem"][data-focus-visible] {
    background: var(--global-color-primary-100);
    outline: 1px solid var(--global-color-primary);
    outline-offset: -1px;
  }
`;

/** The most primitive tree: bare divs, raw text, keyboard navigable. */
export const PrimitiveTree: StoryFn = () => (
  <Tree
    aria-label="Primitive tree"
    selectionMode="single"
    defaultExpandedKeys="all"
    css={treeCSS}
  >
    {["One", "Two", "Three"].map((label) => (
      <TreeItem key={label} textValue={label}>
        <TreeItemContent>{label}</TreeItemContent>
        {["A", "B", "C"].map((child) => (
          <TreeItem key={`${label}-${child}`} textValue={child}>
            <TreeItemContent>{child}</TreeItemContent>
          </TreeItem>
        ))}
      </TreeItem>
    ))}
  </Tree>
);
