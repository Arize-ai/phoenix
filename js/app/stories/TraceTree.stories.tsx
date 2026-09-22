import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";

import {
  TraceTree,
  TraceTreeProvider,
} from "@phoenix/components/trace/TraceTree";
import type { ISpanItem } from "@phoenix/components/trace/types";
import { PreferencesProvider } from "@phoenix/contexts";

import { traceTreeFrameStyle } from "./constants/traceTreeFrame";

/**
 * Builds a span with sensible defaults. `startOffsetMs` is relative to the
 * trace start so a fixture reads as a timeline.
 */
function span(
  overrides: Partial<ISpanItem> & {
    id: string;
    name: string;
    spanKind: string;
    startOffsetMs: number;
    /** `null` leaves the span open: no end time and no latency. */
    latencyMs: number | null;
  }
): ISpanItem {
  const { startOffsetMs, latencyMs, ...rest } = overrides;
  const traceStart = Date.parse("2026-09-22T09:30:00.000Z");
  const start = new Date(traceStart + startOffsetMs);
  return {
    spanId: rest.id,
    parentId: null,
    statusCode: "OK",
    startTime: start.toISOString(),
    endTime:
      latencyMs == null
        ? null
        : new Date(start.getTime() + latencyMs).toISOString(),
    latencyMs,
    ...rest,
  };
}

/**
 * The trace from the issue: an agent plays a round of a game, and the one
 * LLM call carries the tokens and cost.
 */
const gameRoundSpans: ISpanItem[] = [
  span({
    id: "play-round",
    name: "play-round",
    spanKind: "chain",
    startOffsetMs: 0,
    latencyMs: 3680,
  }),
  span({
    id: "record-user-move",
    name: "record-user-move",
    spanKind: "tool",
    parentId: "play-round",
    startOffsetMs: 2,
    latencyMs: 3,
  }),
  span({
    id: "choose-move",
    name: "choose-move",
    spanKind: "agent",
    parentId: "play-round",
    startOffsetMs: 6,
    latencyMs: 3671,
  }),
  span({
    id: "step",
    name: "step",
    spanKind: "chain",
    parentId: "choose-move",
    startOffsetMs: 7,
    latencyMs: 3670,
  }),
  span({
    id: "chat",
    name: "chat",
    spanKind: "llm",
    parentId: "step",
    startOffsetMs: 8,
    latencyMs: 3668,
    tokenCountTotal: 1234,
    costSummary: { total: { cost: 0.00942 } },
  }),
  span({
    id: "resolve-round",
    name: "resolve-round",
    spanKind: "chain",
    parentId: "play-round",
    startOffsetMs: 3678,
    latencyMs: 2,
  }),
  span({
    id: "user-won",
    name: "user-won",
    spanKind: "tool",
    parentId: "resolve-round",
    startOffsetMs: 3679,
    latencyMs: 1,
  }),
];

/**
 * A RAG trace with several LLM calls so a column of metrics rows can be
 * scanned, plus a retrieval failure.
 */
const ragSpans: ISpanItem[] = [
  span({
    id: "query",
    name: "query",
    spanKind: "chain",
    startOffsetMs: 0,
    latencyMs: 8420,
  }),
  span({
    id: "embed",
    name: "embed_query",
    spanKind: "embedding",
    parentId: "query",
    startOffsetMs: 3,
    latencyMs: 212,
    tokenCountTotal: 18,
    costSummary: { total: { cost: 0.0000004 } },
  }),
  span({
    id: "retrieve",
    name: "retrieve",
    spanKind: "retriever",
    parentId: "query",
    startOffsetMs: 220,
    latencyMs: 640,
    statusCode: "ERROR",
  }),
  span({
    id: "rerank",
    name: "rerank",
    spanKind: "reranker",
    parentId: "query",
    startOffsetMs: 870,
    latencyMs: 1330,
  }),
  span({
    id: "synthesize",
    name: "synthesize",
    spanKind: "chain",
    parentId: "query",
    startOffsetMs: 2210,
    latencyMs: 6200,
  }),
  span({
    id: "llm-draft",
    name: "gpt-5.5 · draft",
    spanKind: "llm",
    parentId: "synthesize",
    startOffsetMs: 2215,
    latencyMs: 2980,
    tokenCountTotal: 4821,
    costSummary: { total: { cost: 0.0212 } },
  }),
  span({
    id: "llm-critique",
    name: "gpt-5.5 · critique",
    spanKind: "llm",
    parentId: "synthesize",
    startOffsetMs: 5200,
    latencyMs: 1410,
    tokenCountTotal: 2107,
    costSummary: { total: { cost: 0.0096 } },
  }),
  span({
    id: "llm-final",
    name: "claude-sonnet-5 · final answer",
    spanKind: "llm",
    parentId: "synthesize",
    startOffsetMs: 6620,
    latencyMs: 1790,
    tokenCountTotal: 3390,
    costSummary: { total: { cost: 0.01477 } },
  }),
  span({
    id: "guardrail",
    name: "guardrail",
    spanKind: "guardrail",
    parentId: "query",
    startOffsetMs: 8412,
    latencyMs: 8,
  }),
];

/**
 * Rows whose footers differ: a span still running (no latency), a span with
 * tokens but no pricing, and a span with everything. Row heights vary.
 */
const mixedSpans: ISpanItem[] = [
  span({
    id: "agent",
    name: "agent-loop",
    spanKind: "agent",
    startOffsetMs: 0,
    latencyMs: 12000,
  }),
  span({
    id: "still-running",
    name: "still-running (open span)",
    spanKind: "tool",
    parentId: "agent",
    startOffsetMs: 10,
    latencyMs: null,
  }),
  span({
    id: "unpriced",
    name: "local-model (no pricing)",
    spanKind: "llm",
    parentId: "agent",
    startOffsetMs: 500,
    latencyMs: 2200,
    tokenCountTotal: 812,
  }),
  span({
    id: "priced",
    name: "hosted-model",
    spanKind: "llm",
    parentId: "agent",
    startOffsetMs: 2800,
    latencyMs: 4100,
    tokenCountTotal: 12045,
    costSummary: { total: { cost: 0.4621 } },
  }),
  span({
    id: "long-name",
    name: "a-very-long-span-name-that-keeps-going-until-it-has-to-be-truncated-by-the-row",
    spanKind: "chain",
    parentId: "agent",
    startOffsetMs: 7000,
    latencyMs: 4900,
  }),
];

const DEEP_LEVELS = 7;
const deepSpans: ISpanItem[] = Array.from(
  { length: DEEP_LEVELS },
  (_, index) => {
    const isLeaf = index === DEEP_LEVELS - 1;
    return span({
      id: `level-${index}`,
      name: `level-${index}`,
      spanKind: isLeaf ? "llm" : index % 2 === 0 ? "chain" : "agent",
      parentId: index === 0 ? null : `level-${index - 1}`,
      startOffsetMs: index * 100,
      latencyMs: 5000 - index * 200,
      tokenCountTotal: isLeaf ? 640 : undefined,
      costSummary: isLeaf ? { total: { cost: 0.0031 } } : undefined,
    });
  }
);

const spansById = new Map(
  [...gameRoundSpans, ...ragSpans, ...mixedSpans, ...deepSpans].map((item) => [
    item.id,
    item,
  ])
);

/**
 * The details the metrics tooltip loads for one span. A span with tokens gets
 * a prompt/completion split and a cache-read entry so the breakdown has
 * something to draw; other spans answer with latency alone.
 */
function buildSpanDetails(nodeId: string) {
  const match = spansById.get(nodeId);
  if (!match) {
    return null;
  }
  const base = { __typename: "Span", id: nodeId, latencyMs: match.latencyMs };
  const total = match.tokenCountTotal;
  if (typeof total !== "number") {
    return {
      ...base,
      tokenCountTotal: null,
      tokenCountPrompt: null,
      tokenCountCompletion: null,
      costSummary: null,
      costDetailSummaryEntries: [],
    };
  }
  const prompt = Math.round(total * 0.72);
  const completion = total - prompt;
  const cacheRead = Math.round(prompt * 0.35);
  const cost = match.costSummary?.total?.cost;
  const costs =
    typeof cost === "number"
      ? { total: cost, prompt: cost * 0.4, completion: cost * 0.6 }
      : null;
  return {
    ...base,
    tokenCountTotal: total,
    tokenCountPrompt: prompt,
    tokenCountCompletion: completion,
    costSummary: costs
      ? {
          total: { cost: costs.total },
          prompt: { cost: costs.prompt },
          completion: { cost: costs.completion },
        }
      : null,
    costDetailSummaryEntries: [
      {
        tokenType: "input",
        isPrompt: true,
        value: {
          tokens: prompt - cacheRead,
          cost: costs ? costs.prompt * 0.8 : null,
        },
      },
      {
        tokenType: "cache_read",
        isPrompt: true,
        value: { tokens: cacheRead, cost: costs ? costs.prompt * 0.2 : null },
      },
      {
        tokenType: "output",
        isPrompt: false,
        value: { tokens: completion, cost: costs?.completion ?? null },
      },
    ],
  };
}

/**
 * Answers the metrics tooltip's query from the fixtures above after a short
 * delay so the lazy load is visible. No requests leave the story.
 */
const mockRelayEnvironment = new Environment({
  network: Network.create(async (_request, variables) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return {
      data: {
        node: buildSpanDetails(String(variables.nodeId)),
      },
    };
  }),
  store: new Store(new RecordSource()),
});

function TraceTreeFrame({
  spans,
  initialSelectedSpanId,
  width = 640,
}: {
  spans: ISpanItem[];
  initialSelectedSpanId?: string;
  width?: number;
}) {
  const [selectedSpanNodeId, setSelectedSpanNodeId] = useState(
    initialSelectedSpanId ?? spans[0].id
  );
  return (
    <div style={{ ...traceTreeFrameStyle, width }}>
      <TraceTreeProvider>
        <TraceTree
          spans={spans}
          selectedSpanNodeId={selectedSpanNodeId}
          onSpanClick={(item) => setSelectedSpanNodeId(item.id)}
          scrollSelectedSpanIntoView={false}
        />
      </TraceTreeProvider>
    </div>
  );
}

/**
 * The trace tree lists a trace's spans as nested rows. Every row is laid out
 * the same way: the span kind icon, then the span name and status on the
 * first line, and a metrics footer on the second line in a fixed order of
 * latency | tokens | cost. Metrics a span lacks are dropped from its footer,
 * so rows differ in height, and the tree edges end at each row's own center.
 *
 * The footer has no per-metric tooltips. Hovering the footer opens one rich
 * tooltip that lazily loads the span's full latency, token and cost
 * breakdown. In these stories a canned Relay environment answers it after a
 * short delay.
 */
const meta: Meta<typeof TraceTree> = {
  title: "Trace/TraceTree",
  component: TraceTree,
  decorators: [
    (Story) => (
      <RelayEnvironmentProvider environment={mockRelayEnvironment}>
        <Story />
      </RelayEnvironmentProvider>
    ),
  ],
  parameters: {
    layout: "padded",
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof TraceTree>;

/** The trace from the issue. Only the LLM span shows tokens and cost. */
export const Default: Story = {
  render: () => <TraceTreeFrame spans={gameRoundSpans} />,
};

/** Several LLM spans in one trace: the footers line up as a scannable column. */
export const ManyLLMSpans: Story = {
  render: () => (
    <TraceTreeFrame spans={ragSpans} initialSelectedSpanId="llm-draft" />
  ),
};

/**
 * Footers of different lengths: an open span has no footer at all, an
 * unpriced model shows latency and tokens, a hosted model shows all three.
 * The edges adapt to each row's height.
 */
export const MixedRowHeights: Story = {
  render: () => <TraceTreeFrame spans={mixedSpans} />,
};

/** An error span keeps its footer; the status icon sits beside the name. */
export const WithError: Story = {
  render: () => (
    <TraceTreeFrame spans={ragSpans} initialSelectedSpanId="retrieve" />
  ),
};

/** Edges stay attached to the icons down a deep chain of two-line rows. */
export const DeeplyNested: Story = {
  render: () => <TraceTreeFrame spans={deepSpans} />,
};

/**
 * With the "show metrics" preference off, footers and timeline bars are
 * gone and every row is a single line.
 */
export const MetricsHidden: Story = {
  render: () => (
    <PreferencesProvider showMetricsInTraceTree={false}>
      <TraceTreeFrame spans={ragSpans} />
    </PreferencesProvider>
  ),
};

export const SideBySide: Story = {
  parameters: { width: "fill" },
  render: () => (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      {[
        { label: "Wide (900px)", width: 900 },
        { label: "Medium (420px)", width: 420 },
        { label: "Compact (260px)", width: 260 },
      ].map(({ label, width }) => (
        <div key={label}>
          <div style={{ marginBottom: 8, fontSize: 12 }}>{label}</div>
          <TraceTreeFrame spans={ragSpans} width={width} />
        </div>
      ))}
    </div>
  ),
};
