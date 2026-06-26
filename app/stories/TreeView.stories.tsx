import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";
import { type ReactNode, useState } from "react";
import {
  Button,
  type Key,
  type Selection,
  Tree,
  TreeItem,
  TreeItemContent,
} from "react-aria-components";

import {
  Icon,
  Icons,
  Metric,
  type MetricKind,
  Text,
} from "@phoenix/components";
import { TimelineBar } from "@phoenix/components/timeline/TimelineBar";
import { useSpanKindColor } from "@phoenix/components/trace/useSpanKindColor";

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
  --tree-row-hover-mix: 5%;
  --tree-row-chevron-hover-mix: 8%;
  --tree-row-selected-mix: 3%;
  --tree-row-selected-hover-mix: 4%;
  --tree-row-selected-chevron-hover-mix: 8%;

  --tree-row-hover-background-color: color-mix(
    in srgb,
    var(--global-card-header-background-color),
    var(--global-color-gray-900) var(--tree-row-hover-mix)
  );
  --tree-row-selected-background-color: color-mix(
    in srgb,
    var(--global-card-header-background-color),
    var(--global-color-gray-900) var(--tree-row-selected-mix)
  );
  --tree-row-selected-hover-background-color: color-mix(
    in srgb,
    var(--global-card-header-background-color),
    var(--global-color-gray-900) var(--tree-row-selected-hover-mix)
  );
  --tree-row-action-hover-background-color: color-mix(
    in srgb,
    var(--global-card-header-background-color),
    var(--global-color-gray-900) var(--tree-row-chevron-hover-mix)
  );
  --tree-row-selected-action-hover-background-color: color-mix(
    in srgb,
    var(--global-card-header-background-color),
    var(--global-color-gray-900) var(--tree-row-selected-chevron-hover-mix)
  );
  width: 460px;
  border: 1px solid var(--global-border-color-default);

  & [role="row"] {
    box-sizing: border-box;
    position: relative;
    display: flex;
    align-items: center;
    border-style: solid;
    border-width: 1px;
    border-color: transparent;
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
  /* subtle neutral hover */
  & [role="row"][data-hovered] {
    background: var(--tree-row-hover-background-color);
  }
  /* top-level siblings are large items; separate those stacks without dividing
     their descendant rows */
  & [role="row"][aria-level="1"]:not(:first-child) {
    border-top-color: var(--global-border-color-default);
  }
  /* subtle selected, with a thick left-edge accent */
  & [role="row"][data-selected] {
    background: var(--tree-row-selected-background-color);
  }
  & [role="row"][data-selected]::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--global-color-primary);
  }
  /* hovering a selected row still shows hover bg */
  & [role="row"][data-selected][data-hovered] {
    background: var(--tree-row-selected-hover-background-color);
  }
  /* keyboard focus gets a full border and must override separators */
  & [role="row"][aria-level][data-focus-visible] {
    border-color: var(--global-color-primary);
  }
  & [role="row"][data-selected][data-focus-visible]::before {
    left: 1px;
    top: 1px;
    bottom: 1px;
  }
  /* clickable expansion button, flush against the row's right edge. Background
     is transparent so it inherits the row's state (normal/hover/selected); it
     only intensifies when the chevron itself is hovered directly. */
  & [slot="chevron"] {
    margin-left: auto;
    align-self: stretch;
    /* fixed width + centered icon so the expanded/collapsed swap doesn't shift layout */
    box-sizing: border-box;
    width: var(--global-dimension-size-400);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    cursor: pointer;
    border: none;
    color: var(--global-text-color-500);
    background: transparent;
  }
  & [slot="chevron"][data-hovered] {
    color: var(--global-text-color-700);
    background: var(--tree-row-action-hover-background-color);
  }
  & [role="row"][data-selected] [slot="chevron"][data-hovered] {
    background: var(--tree-row-selected-action-hover-background-color);
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
     chevron, holds the timing graph */
  & .row-extra {
    display: flex;
    align-items: center;
    padding-left: var(--global-dimension-size-200);
    width: 110px;
    flex: none;
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
  & [role="row"][data-selected] .atom--prefix {
    color: var(--global-text-color-900);
  }
  /* dot: an 8x8 rounded-square status indicator, tinted by span kind */
  & .atom--dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 2px;
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
                  <Icon
                    svg={
                      isExpanded ? (
                        <Icons.ChevronDownSmall />
                      ) : (
                        <Icons.ChevronRightSmall />
                      )
                    }
                  />
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
type RowData = {
  prefix?: string;
  title?: string;
  previews?: string[];
  kind?: string; // openinference span kind, drives the dot color
};
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
const CHIP_GROUPS: Record<string, { kind: MetricKind; value: ReactNode }[]> = {
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

const STORY_TIMELINE_START_MS = Date.UTC(2026, 5, 6, 23, 24, 0);
const STORY_TIMELINE_DURATION_MS = 10_000;
const STORY_TIMELINE_RANGE: TimeRange = {
  start: new Date(STORY_TIMELINE_START_MS),
  end: new Date(STORY_TIMELINE_START_MS + STORY_TIMELINE_DURATION_MS),
};

const getStorySpanTimeRange = ({ prefix }: { prefix?: string }): TimeRange => {
  const rowIndex = Number(prefix) || 1;
  const startPercentage = ((rowIndex - 1) % 8) * 8;
  const durationPercentage = 16 + (rowIndex % 3) * 8;
  const endPercentage = Math.min(100, startPercentage + durationPercentage);
  return {
    start: new Date(
      STORY_TIMELINE_START_MS +
        (STORY_TIMELINE_DURATION_MS * startPercentage) / 100
    ),
    end: new Date(
      STORY_TIMELINE_START_MS +
        (STORY_TIMELINE_DURATION_MS * endPercentage) / 100
    ),
  };
};

type RowLayout = {
  icon?: boolean; // outer leading "Icon" box
  timing?: boolean; // outer trailing "Timing" box
  chevron?: boolean; // outer trailing expand control
  headline: (keyof typeof ATOM_LABEL)[]; // first line; "title" flexes
  previews?: number; // number of full-width preview lines
  chips?: "packed" | "spread" | false; // metric/annotation/source chip groups
};
type RowLayoutResolver =
  | RowLayout
  | ((node: TreeNode, level: number) => RowLayout);

const getLayoutWithTiming = ({
  layout,
  isTimingVisible,
}: {
  layout: RowLayout;
  isTimingVisible: boolean;
}): RowLayout => ({
  ...layout,
  timing: isTimingVisible,
});

const LAYOUTS: Record<string, RowLayout> = {
  // current track
  general: {
    icon: true,
    chevron: true,
    headline: ["prefix", "title", "date"],
    previews: 2,
    chips: "spread",
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

const TimingGraph = ({ data }: { data?: RowData }) => {
  const color = useSpanKindColor({ spanKind: data?.kind ?? "" });
  return (
    <TimelineBar
      aria-hidden
      color={color}
      overallTimeRange={STORY_TIMELINE_RANGE}
      spanTimeRange={getStorySpanTimeRange({ prefix: data?.prefix })}
    />
  );
};

const RowMain = ({ layout, data }: { layout: RowLayout; data?: RowData }) => {
  const previewCount = layout.previews ?? 0;
  const previews =
    data?.previews ??
    Array.from({ length: previewCount }, () => "Preview line");
  // filled dot tinted by span kind (gray fallback for unknown/absent kinds)
  const dotColor = useSpanKindColor({ spanKind: data?.kind ?? "" });
  return (
    <div className="row-main">
      <div className="row-line">
        {layout.headline.map((atom) => {
          // dot renders as a filled rounded swatch in the span-kind color
          if (atom === "dot") {
            return (
              <span
                className="atom atom--dot"
                key={atom}
                aria-hidden
                style={{ backgroundColor: dotColor }}
              />
            );
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
              <Text
                className="atom atom--prefix"
                key={atom}
                size="XS"
                color="text-400"
                fontFamily="mono"
              >
                {data?.prefix ?? ATOM_LABEL.prefix}
              </Text>
            );
          }
          const label =
            atom === "title"
              ? (data?.title ?? ATOM_LABEL.title)
              : ATOM_LABEL[atom];
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
    <Icon
      svg={
        isExpanded ? <Icons.ChevronDownSmall /> : <Icons.ChevronRightSmall />
      }
    />
  </Button>
);

// `level` (1-based, from react-aria) drives indentation; leaves render no chevron.
// Factory so each tree can bind its own onRowInteract; recurses via `render`.
// With a `layout` the row renders that wireframe; without one it falls back to
// the plain single-line label (used by PrimitiveTree/NestedTree).
const makeRenderNode = (
  onRowInteract: (key: Key) => void,
  layout?: RowLayoutResolver
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
          const indent = `calc(${level} * var(--global-dimension-size-150))`;
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
          const rowLayout =
            typeof layout === "function" ? layout(node, level) : layout;
          return (
            <>
              <div className="row-content" style={{ paddingLeft: indent }}>
                {rowLayout.icon && <span className="lead-icon" aria-hidden />}
                <RowMain layout={rowLayout} data={node.data} />
                {rowLayout.timing && (
                  <span className="row-extra">
                    <TimingGraph data={node.data} />
                  </span>
                )}
              </div>
              {rowLayout.chevron && chevron}
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
  layout?: RowLayoutResolver;
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

// Compact node builder: title becomes both the label and the row title; optional
// input/output preview lines and children. Prefixes are auto-numbered downstream.
const node = (
  id: string,
  title: string,
  previews?: string[],
  children?: TreeNode[],
  kind?: string
): TreeNode => ({
  id,
  label: title,
  data: { title, previews, kind },
  children,
});

// Realistic content per example. Span/trace rows use OpenInference-style
// operation names; turn rows simulate a PXI agent Q&A, user then model.

// current-track General: a span tree with input/output previews
const GENERAL_NODES: TreeNode[] = [
  node(
    "gen/run",
    "AgentExecutor.run",
    [
      "User: summarize the last 3 incidents in the payments service",
      "Assistant: 3 incidents in 24h — two gateway timeouts and a cert expiry…",
    ],
    [
      node(
        "gen/retrieve",
        "retrieve_context",
        [
          "query: payments service incidents, window=24h",
          "5 documents retrieved: incident-4821, incident-4822, incident-4830…",
        ],
        [
          node("gen/vs", "VectorStore.similarity_search", [
            "embedding(query) · top_k=5",
            "incident-4821 (0.91), incident-4822 (0.88), incident-4830 (0.86)…",
          ]),
        ]
      ),
      node(
        "gen/llm",
        "ChatOpenAI.generate",
        [
          "system: you are an SRE assistant · user: summarize incidents…",
          "There were 3 incidents: GatewayTimeout at 02:14 and 02:51, plus a…",
        ],
        [
          node("gen/parse", "OutputParser.parse", [
            "raw: incidents=[GatewayTimeout, GatewayTimeout, CertExpiry]",
            "parsed 3 incident objects",
          ]),
        ]
      ),
    ]
  ),
];

// current-track Trace / Span: operation names only, no previews
const TRACE_SPAN_NODES: TreeNode[] = [
  node("ts/run", "AgentExecutor.run", undefined, [
    node(
      "ts/llm",
      "ChatOpenAI.generate",
      undefined,
      [node("ts/parse", "OutputParser.parse", undefined, undefined, "chain")],
      "llm"
    ),
    node(
      "ts/search",
      "tool: web_search",
      undefined,
      [node("ts/http", "HTTP GET api.search", undefined, undefined, "tool")],
      "tool"
    ),
  ]),
  node(
    "ts/embed",
    "OpenAIEmbeddings.embed_query",
    undefined,
    [
      node(
        "ts/vs",
        "VectorStore.similarity_search",
        undefined,
        undefined,
        "retriever"
      ),
    ],
    "embedding"
  ),
  node("ts/rerank", "CohereRerank.rerank", undefined, undefined, "reranker"),
];

// current-track Turn: simulated PXI agent turns
const TURN_NODES: TreeNode[] = [
  node("turn/0", "PXI Agent Turn", [
    "How many spans errored in checkout-service over the last 24h, and which operation fails most?",
    "Over 24h checkout-service logged 1,284 spans; 37 errored (2.9%), mostly from POST /charge hitting the payments gateway.",
  ]),
  node("turn/1", "PXI Agent Turn", [
    "Group those failing charge spans by error type and show p95 latency for each.",
    "GatewayTimeout: 21 spans, p95 8.4s · CardDeclined: 11 spans, p95 1.2s · RateLimited: 5 spans, p95 3.0s.",
  ]),
];

// alternate Turn: a different simulated PXI agent exchange
const TURN_ALT_NODES: TreeNode[] = [
  node("turn-alt/0", "PXI Agent Turn", [
    "Which traces have the highest token cost today?",
    "Top 3 by cost: trace 9f2a ($0.42), trace 7c11 ($0.31), trace 5d80 ($0.28).",
  ]),
  node("turn-alt/1", "PXI Agent Turn", [
    "Show the span breakdown for trace 9f2a.",
    "trace 9f2a: 6 spans — AgentExecutor.run → 2× ChatOpenAI.generate, retrieve_context, 2× tool calls.",
  ]),
];

// alternate Trace: top-level traces with compact span children
const TRACE_ALT_NODES: TreeNode[] = [
  node("trace-alt/checkout", "trace 9f2a · checkout charge", undefined, [
    node("trace-alt/checkout/root", "AgentExecutor.run", undefined, [
      node(
        "trace-alt/checkout/llm",
        "ChatOpenAI.generate",
        undefined,
        undefined,
        "llm"
      ),
      node(
        "trace-alt/checkout/payments",
        "POST /charge",
        undefined,
        undefined,
        "tool"
      ),
    ]),
    node(
      "trace-alt/checkout/retrieve",
      "retrieve_context",
      undefined,
      undefined,
      "retriever"
    ),
  ]),
  node("trace-alt/support", "trace 7c11 · support lookup", undefined, [
    node("trace-alt/support/root", "AgentExecutor.run", undefined, [
      node(
        "trace-alt/support/search",
        "tool: search_tickets",
        undefined,
        undefined,
        "tool"
      ),
      node(
        "trace-alt/support/llm",
        "ChatOpenAI.generate",
        undefined,
        undefined,
        "llm"
      ),
    ]),
  ]),
  node("trace-alt/summary", "trace 5d80 · incident summary", undefined, [
    node(
      "trace-alt/summary/embed",
      "OpenAIEmbeddings.embed_query",
      undefined,
      undefined,
      "embedding"
    ),
    node(
      "trace-alt/summary/rerank",
      "CohereRerank.rerank",
      undefined,
      undefined,
      "reranker"
    ),
    node(
      "trace-alt/summary/llm",
      "ChatOpenAI.generate",
      undefined,
      undefined,
      "llm"
    ),
  ]),
];

const SPAN_ALT_NODES: TreeNode[] = [
  node(
    "span-alt/run",
    "AgentExecutor.run",
    undefined,
    [
      node(
        "span-alt/llm",
        "ChatOpenAI.generate",
        undefined,
        [
          node(
            "span-alt/parse",
            "OutputParser.parse",
            undefined,
            undefined,
            "chain"
          ),
        ],
        "llm"
      ),
      node(
        "span-alt/retrieve",
        "retrieve_context",
        undefined,
        [
          node(
            "span-alt/vs",
            "VectorStore.similarity_search",
            undefined,
            undefined,
            "retriever"
          ),
        ],
        "retriever"
      ),
    ],
    "agent"
  ),
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

const Example = ({
  name,
  children,
  action,
}: {
  name: string;
  children: ReactNode;
  action?: ReactNode;
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
      }}
    >
      <Text size="S" fontFamily="mono" color="text-700">
        {name}
      </Text>
      {action}
    </div>
    {children}
  </div>
);

const TimingToggle = ({
  isTimingVisible,
  onToggleTiming,
}: {
  isTimingVisible: boolean;
  onToggleTiming: () => void;
}) => (
  <Button
    aria-label={isTimingVisible ? "Hide timing" : "Show timing"}
    onPress={onToggleTiming}
    style={{
      background: "transparent",
      border: "none",
      color: "var(--global-text-color-500)",
      cursor: "pointer",
      font: "inherit",
      fontSize: 12,
      padding: 0,
    }}
  >
    Timing
  </Button>
);

/** The six row layouts, grouped Current track / Alternate like the spec. */
export const ExampleTrees: StoryFn = () => {
  const [isTimingVisible, setIsTimingVisible] = useState(true);
  const onToggleTiming = () => setIsTimingVisible((isVisible) => !isVisible);
  const getTraceSpanLayout = (_node: TreeNode, level: number) =>
    getLayoutWithTiming({
      layout: level === 1 ? LAYOUTS.traceSpan : LAYOUTS.spanAlt,
      isTimingVisible,
    });
  const getTraceLayout = (_node: TreeNode, level: number) =>
    getLayoutWithTiming({
      layout: level === 1 ? LAYOUTS.traceAlt : LAYOUTS.spanAlt,
      isTimingVisible,
    });
  const spanLayout = getLayoutWithTiming({
    layout: LAYOUTS.spanAlt,
    isTimingVisible,
  });

  return (
    <div style={{ display: "flex", gap: "3rem", alignItems: "flex-start" }}>
      <Column title="Current track">
        <Example name="General">
          <StandaloneTree
            label="General"
            layout={LAYOUTS.general}
            nodes={GENERAL_NODES}
          />
        </Example>
        <Example
          name="Trace / Span"
          action={
            <TimingToggle
              isTimingVisible={isTimingVisible}
              onToggleTiming={onToggleTiming}
            />
          }
        >
          <StandaloneTree
            label="Trace / Span"
            layout={getTraceSpanLayout}
            nodes={TRACE_SPAN_NODES}
          />
        </Example>
        <Example name="Turn">
          <StandaloneTree
            label="Turn"
            layout={LAYOUTS.turn}
            nodes={TURN_NODES}
          />
        </Example>
      </Column>
      <Column title="Alternate">
        <Example name="Turn">
          <StandaloneTree
            label="Turn"
            layout={LAYOUTS.turnAlt}
            nodes={TURN_ALT_NODES}
          />
        </Example>
        <Example
          name="Trace"
          action={
            <TimingToggle
              isTimingVisible={isTimingVisible}
              onToggleTiming={onToggleTiming}
            />
          }
        >
          <StandaloneTree
            label="Trace"
            layout={getTraceLayout}
            nodes={TRACE_ALT_NODES}
          />
        </Example>
        <Example
          name="Span"
          action={
            <TimingToggle
              isTimingVisible={isTimingVisible}
              onToggleTiming={onToggleTiming}
            />
          }
        >
          <StandaloneTree
            label="Span"
            layout={spanLayout}
            nodes={SPAN_ALT_NODES}
          />
        </Example>
      </Column>
    </div>
  );
};
