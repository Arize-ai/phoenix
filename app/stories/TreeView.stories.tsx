import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";
import { type ReactNode, useState } from "react";

import { Metric, type MetricKind, Text } from "@phoenix/components";
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
  width: 460px;
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
    /* allow the body to shrink below its content so previews can truncate */
    min-width: 0;
    display: flex;
    align-items: center;
    padding: var(--global-dimension-size-100);
  }
  /* main content: a vertical stack of up to three lines */
  & .row-main {
    flex: 1;
    min-width: 0;
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
  /* darker selected */
  & [role="row"][data-selected] {
    background: var(--global-list-item-selected-background-color);
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
  /* clickable expansion button, flush against the row's right edge. Background
     is transparent so it inherits the row's state (normal/hover/selected); it
     only intensifies when the chevron itself is hovered directly. */
  & [slot="chevron"] {
    margin-left: auto;
    align-self: stretch;
    /* fixed width + centered glyph so the ▾/▸ swap doesn't shift layout */
    box-sizing: border-box;
    width: var(--global-dimension-size-400);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    cursor: pointer;
    border: none;
    background: transparent;
  }
  & [slot="chevron"][data-hovered] {
    background: var(--global-input-field-background-color-hover);
  }
  /* leaf-row filler: same footprint as the chevron, empty and non-interactive —
     transparent so it tracks the row background like the chevron does */
  & .chevron-placeholder {
    margin-left: auto;
    align-self: stretch;
    box-sizing: border-box;
    width: var(--global-dimension-size-400);
    background: transparent;
  }

  /* ---- layout demo pieces (six example-tree row layouts) ---- */
  /* leading icon slot: an 18x18 placeholder, top-aligned and indented inline
     with the rest of the row content */
  & .lead-icon {
    flex: none;
    align-self: flex-start;
    width: 18px;
    height: 18px;
    margin-right: var(--global-dimension-size-100);
    border: 1px solid var(--global-border-color-default);
    border-radius: var(--global-rounding-small);
  }
  /* "extra" column inside the body: sits between the main content and the
     chevron, holds the timing readout */
  & .row-extra {
    display: flex;
    align-items: center;
    padding-left: var(--global-dimension-size-200);
    font-size: 12px;
    white-space: nowrap;
    /* debug tint to make the extras region visible */
    background: rgba(255, 0, 255, 0.1);
  }
  /* stack the body lines with a little breathing room */
  & .row-main {
    gap: var(--global-dimension-size-50);
  }
  /* inline atom text; title grows to push date/time to the right edge */
  & .atom {
    font-size: 12px;
    white-space: nowrap;
  }
  & .atom--title {
    flex: 1;
  }
  /* dot: an 8x8 fully-rounded placeholder, like a status indicator */
  & .atom--dot {
    flex: none;
    width: 8px;
    height: 8px;
    border: 1px solid var(--global-border-color-default);
    border-radius: var(--global-rounding-full);
  }
  & .row-preview {
    font-size: 12px;
    color: var(--global-text-color-400);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  /* chip row: groups packed left by default, or spread across full width */
  & .row-chips {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--global-dimension-size-200);
  }
  & .row-chips--spread {
    justify-content: space-between;
  }
  & .chip-group {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
  }
`;

// Shared tree state + the unified interaction model. An "interaction" is any
// activation of a row — pointer click OR keyboard (Enter/Space) — since
// react-aria fires onPressStart for both. The rule, applied identically to all:
//   - row inactive → activate it, leave fold state alone
//   - row already active → toggle its fold
// The chevron button is separate and always toggles fold (react-aria slot).
const useTreeState = (initialExpanded: Iterable<Key> = []) => {
  const [selected, setSelected] = useState<Selection>(new Set<Key>());
  const [expanded, setExpanded] = useState<Set<Key>>(new Set(initialExpanded));

  const toggleExpanded = (key: Key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // `selected` is the pre-press value, so the press that first activates a row
  // is a no-op for fold; only a press on an already-active row toggles it.
  const onRowInteract = (key: Key) => {
    if (selected instanceof Set && selected.has(key)) toggleExpanded(key);
  };

  const treeProps = {
    selectionMode: "single" as const,
    disallowEmptySelection: true,
    selectedKeys: selected,
    onSelectionChange: setSelected,
    expandedKeys: expanded,
    onExpandedChange: (keys: Selection) => setExpanded(new Set(keys)),
  };

  return { treeProps, onRowInteract };
};

/** The most primitive tree: bare divs, raw text, keyboard + mouse navigable. */
export const PrimitiveTree: StoryFn = () => {
  const { treeProps, onRowInteract } = useTreeState();

  return (
    <Tree aria-label="Primitive tree" css={treeCSS} {...treeProps}>
      {PARENTS.map((label) => (
        <TreeItem
          key={label}
          id={label}
          textValue={label}
          onPressStart={() => onRowInteract(label)}
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
              onPressStart={() => onRowInteract(`${label}-${child}`)}
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

// Optional per-row content overrides; atoms fall back to placeholders when a
// field is absent, so most example trees stay as bare layout demos.
type RowData = { prefix?: string; title?: string; previews?: string[] };
type TreeNode = {
  id: string;
  label: string;
  children?: TreeNode[];
  data?: RowData;
};

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

// ---- six row layouts -------------------------------------------------------
// The wireframe is a layout spec, so rows render labeled placeholder boxes
// ("Prefix", "Title", chips…) rather than real node content. A single
// config-driven renderer covers all six; each `RowLayout` describes the outer
// columns (icon / timing / chevron), the headline atoms, preview lines, and
// chip arrangement.
// sample metrics per chip group, in the order they appear in the wireframe
const CHIP_GROUPS: Record<
  string,
  { kind: MetricKind; value: ReactNode }[]
> = {
  metrics: [
    { kind: "token", value: "1.2k" },
    { kind: "latency", value: "320ms" },
    { kind: "cost", value: "0.04" },
  ],
  annotations: [
    { kind: "feedback", value: 2 },
    { kind: "note", value: 1 },
  ],
  source: [
    { kind: "tool", value: 3 },
    { kind: "llm", value: 5 },
  ],
};

const ATOM_LABEL: Record<string, string> = {
  prefix: "Prefix",
  badge: "Badge",
  title: "Title",
  date: "Jun 6 11:24 PM",
  time: "Jun 6 11:24 PM",
  dot: "Dot",
};

type RowLayout = {
  icon?: boolean; // outer leading "Icon" box
  timing?: boolean; // outer trailing "Timing" box
  chevron?: boolean; // outer trailing expand control
  headline: (keyof typeof ATOM_LABEL)[]; // first line; "title" flexes
  previews?: number; // number of full-width preview lines
  chips?: "packed" | "spread" | false; // metric/annotation/source chip groups
};

const LAYOUTS: Record<string, RowLayout> = {
  // current track
  general: {
    icon: true,
    chevron: true,
    headline: ["prefix", "title", "date"],
    previews: 2,
    chips: "packed",
  },
  traceSpan: {
    icon: true,
    chevron: true,
    headline: ["prefix", "title", "date"],
    chips: "spread",
  },
  turn: {
    headline: ["prefix", "title", "date"],
    previews: 2,
    chips: "spread",
  },
  // alternate
  turnAlt: {
    headline: ["prefix", "badge", "title", "time"],
    previews: 2,
    chips: "packed",
  },
  traceAlt: {
    timing: true,
    chevron: true,
    headline: ["prefix", "badge", "title", "time"],
    chips: "packed",
  },
  spanAlt: {
    timing: true,
    chevron: true,
    headline: ["dot", "title"],
  },
};

const Chips = ({ spread }: { spread?: boolean }) => (
  <div className={`row-chips${spread ? " row-chips--spread" : ""}`}>
    {Object.keys(CHIP_GROUPS).map((group) => (
      <div className="chip-group" key={group}>
        {CHIP_GROUPS[group].map((m) => (
          <Metric kind={m.kind} key={m.kind}>
            {m.value}
          </Metric>
        ))}
      </div>
    ))}
  </div>
);

const RowMain = ({ layout, data }: { layout: RowLayout; data?: RowData }) => {
  const previewCount = layout.previews ?? 0;
  const previews =
    data?.previews ?? Array.from({ length: previewCount }, () => "Preview line");
  return (
    <div className="row-main">
      <div className="row-line">
        {layout.headline.map((atom) => {
          // dot renders as an empty rounded swatch (styled in CSS)
          if (atom === "dot") {
            return <span className="atom atom--dot" key={atom} aria-hidden />;
          }
          // date/time use the same small grey text as the metrics, sans mono
          if (atom === "date" || atom === "time") {
            return (
              <Text key={atom} size="XS" color="text-400">
                {ATOM_LABEL[atom]}
              </Text>
            );
          }
          // prefix: subdued monospace index, like the metric counts
          if (atom === "prefix") {
            return (
              <Text key={atom} size="XS" color="text-400" fontFamily="mono">
                {data?.prefix ?? ATOM_LABEL.prefix}
              </Text>
            );
          }
          const label =
            atom === "title" ? (data?.title ?? ATOM_LABEL.title) : ATOM_LABEL[atom];
          return (
            <span className={`atom atom--${atom}`} key={atom}>
              {label}
            </span>
          );
        })}
      </div>
      {previewCount > 0 &&
        previews.map((line, i) => (
          <div className="row-preview" key={i}>
            {line}
          </div>
        ))}
      {layout.chips && <Chips spread={layout.chips === "spread"} />}
    </div>
  );
};

const Chevron = ({ isExpanded }: { isExpanded: boolean }) => (
  <Button slot="chevron" aria-label={isExpanded ? "Collapse" : "Expand"}>
    {isExpanded ? "▾" : "▸"}
  </Button>
);

// `level` (1-based, from react-aria) drives indentation; leaves render no chevron.
// Factory so each tree can bind its own onRowInteract; recurses via `render`.
// With a `layout` the row renders that wireframe; without one it falls back to
// the plain single-line label (used by PrimitiveTree/NestedTree).
const makeRenderNode = (
  onRowInteract: (key: Key) => void,
  layout?: RowLayout
) => {
  const render = (node: TreeNode) => (
    <TreeItem
      key={node.id}
      id={node.id}
      textValue={node.label}
      onPressStart={() => onRowInteract(node.id)}
    >
      <TreeItemContent>
        {({ isExpanded, level, hasChildItems }) => {
          const indent = `calc(${level - 1} * 1.25rem + var(--global-dimension-size-100))`;
          const chevron = hasChildItems ? (
            <Chevron isExpanded={isExpanded} />
          ) : (
            <span className="chevron-placeholder" aria-hidden />
          );
          if (!layout) {
            return (
              <>
                <div className="row-content" style={{ paddingLeft: indent }}>
                  <div className="row-main">
                    <div className="row-line">{node.label}</div>
                  </div>
                </div>
                {chevron}
              </>
            );
          }
          return (
            <>
              <div className="row-content" style={{ paddingLeft: indent }}>
                {layout.icon && <span className="lead-icon" aria-hidden />}
                <RowMain layout={layout} data={node.data} />
                {layout.timing && <span className="row-extra">Timing</span>}
              </div>
              {layout.chevron && chevron}
            </>
          );
        }}
      </TreeItemContent>
      {node.children?.map(render)}
    </TreeItem>
  );
  return render;
};

/** Arbitrary-depth tree, rendered recursively. Same keyboard + mouse model. */
export const NestedTree: StoryFn = () => {
  const { treeProps, onRowInteract } = useTreeState([
    "agent",
    "agent.act",
    "agent.act.tool",
  ]);
  const renderNode = makeRenderNode(onRowInteract);

  return (
    <Tree aria-label="Nested tree" css={treeCSS} {...treeProps}>
      {NESTED.map(renderNode)}
    </Tree>
  );
};

// Number every row's prefix sequentially (depth-first, zero-padded). A node's
// own data.prefix wins, so curated rows (the PXI turns) keep their numbers.
const withPrefixNumbers = (nodes: TreeNode[]): TreeNode[] => {
  let n = 0;
  const walk = (list: TreeNode[]): TreeNode[] =>
    list.map((node) => {
      n += 1;
      return {
        ...node,
        data: { prefix: String(n).padStart(2, "0"), ...node.data },
        children: node.children ? walk(node.children) : undefined,
      };
    });
  return walk(nodes);
};

// One self-contained tree with its own selection/expansion state, so several can
// stack independently. Expands everything by default.
const StandaloneTree = ({
  label,
  nodes,
  layout,
}: {
  label: string;
  nodes: TreeNode[];
  layout?: RowLayout;
}) => {
  const numbered = withPrefixNumbers(nodes);
  const allIds = (ns: TreeNode[]): Key[] =>
    ns.flatMap((n) => [n.id, ...(n.children ? allIds(n.children) : [])]);
  const { treeProps, onRowInteract } = useTreeState(allIds(numbered));
  const renderNode = makeRenderNode(onRowInteract, layout);

  return (
    <Tree aria-label={label} css={treeCSS} {...treeProps}>
      {numbered.map(renderNode)}
    </Tree>
  );
};

// A parent node with `count` leaf children, id-prefixed so reused shapes stay
// unique. Labels are ignored by the layout renderer (it draws placeholders).
const parentWith = (prefix: string, count: number): TreeNode => ({
  id: prefix,
  label: prefix,
  children: Array.from({ length: count }, (_, i) => ({
    id: `${prefix}/${i}`,
    label: `${prefix} child ${i}`,
  })),
});

// A flat list of `count` rows (no parent) — for the chevron-less turn layouts.
const flatRows = (prefix: string, count: number): TreeNode[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}/${i}`,
    label: `${prefix} ${i}`,
  }));

// Realistic content for the current-track Turn example: simulated PXI agent
// turns, user input then model output, each truncated to one line.
const PXI_TURNS: TreeNode[] = [
  {
    id: "turn/0",
    label: "PXI Agent Turn",
    data: {
      prefix: "01",
      title: "PXI Agent Turn",
      previews: [
        "How many spans errored in checkout-service over the last 24h, and which operation fails most?",
        "Over 24h checkout-service logged 1,284 spans; 37 errored (2.9%), mostly from POST /charge hitting the payments gateway.",
      ],
    },
  },
  {
    id: "turn/1",
    label: "PXI Agent Turn",
    data: {
      prefix: "02",
      title: "PXI Agent Turn",
      previews: [
        "Group those failing charge spans by error type and show p95 latency for each.",
        "GatewayTimeout: 21 spans, p95 8.4s · CardDeclined: 11 spans, p95 1.2s · RateLimited: 5 spans, p95 3.0s.",
      ],
    },
  },
];

const Column = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
    <strong>{title}</strong>
    {children}
  </div>
);

/** The six row layouts, grouped Current track / Alternate like the spec. */
export const ExampleTrees: StoryFn = () => (
  <div style={{ display: "flex", gap: "3rem", alignItems: "flex-start" }}>
    <Column title="Current track">
      <StandaloneTree
        label="General"
        layout={LAYOUTS.general}
        nodes={[parentWith("general", 2)]}
      />
      <StandaloneTree
        label="Trace / Span"
        layout={LAYOUTS.traceSpan}
        nodes={[parentWith("trace-span", 2)]}
      />
      <StandaloneTree label="Turn" layout={LAYOUTS.turn} nodes={PXI_TURNS} />
    </Column>
    <Column title="Alternate">
      <StandaloneTree
        label="Turn"
        layout={LAYOUTS.turnAlt}
        nodes={flatRows("turn-alt", 2)}
      />
      <StandaloneTree
        label="Trace"
        layout={LAYOUTS.traceAlt}
        nodes={[parentWith("trace-alt", 2)]}
      />
      <StandaloneTree
        label="Span"
        layout={LAYOUTS.spanAlt}
        nodes={[parentWith("span-alt", 2)]}
      />
    </Column>
  </div>
);
