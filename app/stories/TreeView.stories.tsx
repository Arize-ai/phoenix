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
  title: "Tree View",
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
  width: 350px;
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
  /* row content: main + (future) extra, side by side, filling up to the chevron.
     Base padding here; the inline paddingLeft adds depth indentation. */
  & .row-content {
    flex: 1;
    display: flex;
    align-items: center;
    padding: var(--global-dimension-size-100);
  }
  /* main content: a vertical stack of up to three lines */
  & .row-main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  /* one line within main: text pieces laid out horizontally */
  & .row-line {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
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
  /* leaf-row filler: same footprint and background as the chevron, but empty
     and non-interactive — keeps the right-hand column visually continuous */
  & .chevron-placeholder {
    margin-left: auto;
    align-self: stretch;
    box-sizing: content-box;
    width: 1ch;
    padding: var(--global-dimension-size-100);
    background: var(--global-input-field-background-color);
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
                <span className="chevron-placeholder" aria-hidden />
              </TreeItemContent>
            </TreeItem>
          ))}
        </TreeItem>
      ))}
    </Tree>
  );
};

type TreeNode = { id: string; label: string; children?: TreeNode[] };

// Arbitrary-depth tree. Mirrors the span-tree shape we'll eventually render:
// a root with nested sub-trees of varying depth.
const NESTED: TreeNode[] = [
  {
    id: "agent",
    label: "agent run",
    children: [
      {
        id: "agent.plan",
        label: "plan",
        children: [
          { id: "agent.plan.llm", label: "llm call" },
          { id: "agent.plan.parse", label: "parse output" },
        ],
      },
      {
        id: "agent.act",
        label: "act",
        children: [
          {
            id: "agent.act.tool",
            label: "tool: search",
            children: [
              { id: "agent.act.tool.http", label: "http request" },
              { id: "agent.act.tool.rank", label: "rank results" },
            ],
          },
          { id: "agent.act.llm", label: "llm call" },
        ],
      },
    ],
  },
  { id: "cleanup", label: "cleanup" },
];

// `level` (1-based, from react-aria) drives indentation; leaves render no chevron.
const renderNode = (node: TreeNode) => (
  <TreeItem key={node.id} id={node.id} textValue={node.label}>
    <TreeItemContent>
      {({ isExpanded, level, hasChildItems }) => (
        <>
          {/* content = main + extra; extra ignored for now */}
          <div
            className="row-content"
            style={{ paddingLeft: `calc(${level - 1} * 1.25rem + var(--global-dimension-size-100))` }}
          >
            <div className="row-main">
              {/* up to three lines; just the label line for now */}
              <div className="row-line">{node.label}</div>
            </div>
          </div>
          {hasChildItems ? (
            <Button slot="chevron" aria-label={isExpanded ? "Collapse" : "Expand"}>
              {isExpanded ? "▾" : "▸"}
            </Button>
          ) : (
            <span className="chevron-placeholder" aria-hidden />
          )}
        </>
      )}
    </TreeItemContent>
    {node.children?.map(renderNode)}
  </TreeItem>
);

/** Arbitrary-depth tree, rendered recursively. Same keyboard + mouse model. */
export const NestedTree: StoryFn = () => {
  const [selected, setSelected] = useState<Selection>(new Set<Key>());
  const [expanded, setExpanded] = useState<Set<Key>>(
    new Set(["agent", "agent.act", "agent.act.tool"])
  );

  return (
    <Tree
      aria-label="Nested tree"
      selectionMode="single"
      css={treeCSS}
      selectedKeys={selected}
      onSelectionChange={setSelected}
      expandedKeys={expanded}
      onExpandedChange={(keys) => setExpanded(new Set(keys))}
    >
      {NESTED.map(renderNode)}
    </Tree>
  );
};

// One self-contained tree with its own selection/expansion state, so several can
// stack independently. Expands everything by default.
const StandaloneTree = ({
  label,
  nodes,
}: {
  label: string;
  nodes: TreeNode[];
}) => {
  const [selected, setSelected] = useState<Selection>(new Set<Key>());
  const allIds = (ns: TreeNode[]): Key[] =>
    ns.flatMap((n) => [n.id, ...(n.children ? allIds(n.children) : [])]);
  const [expanded, setExpanded] = useState<Set<Key>>(new Set(allIds(nodes)));

  return (
    <Tree
      aria-label={label}
      selectionMode="single"
      css={treeCSS}
      selectedKeys={selected}
      onSelectionChange={setSelected}
      expandedKeys={expanded}
      onExpandedChange={(keys) => setExpanded(new Set(keys))}
    >
      {nodes.map(renderNode)}
    </Tree>
  );
};

// "root span" → "mid span" (→ "end span") + "end span". Prefixed ids keep this
// stack unique when it's reused inside other trees.
const spanStack = (prefix: string): TreeNode => ({
  id: `${prefix}/root`,
  label: "root span",
  children: [
    {
      id: `${prefix}/mid`,
      label: "mid span",
      children: [{ id: `${prefix}/mid/end`, label: "end span" }],
    },
    { id: `${prefix}/end`, label: "end span" },
  ],
});

/** Several independent trees stacked: span, trace, session shapes. */
export const ExampleTrees: StoryFn = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
    <StandaloneTree label="Span" nodes={[spanStack("span")]} />
    <StandaloneTree
      label="Trace"
      nodes={[{ id: "trace", label: "Trace", children: [spanStack("trace")] }]}
    />
    <StandaloneTree
      label="Session turns"
      nodes={[
        {
          id: "session",
          label: "Session",
          children: [1, 2, 3, 4].map((n) => ({
            id: `session/turn-${n}`,
            label: `turn ${n}`,
          })),
        },
      ]}
    />
    <StandaloneTree
      label="Session traces"
      nodes={[
        {
          id: "session2",
          label: "Session",
          children: [1, 2, 3].map((n) => ({
            id: `session2/trace-${n}`,
            label: "Trace",
            children: [spanStack(`session2/trace-${n}`)],
          })),
        },
      ]}
    />
  </div>
);
