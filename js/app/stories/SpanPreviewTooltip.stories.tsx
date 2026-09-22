import type { Meta, StoryObj } from "@storybook/react";
import { Focusable } from "react-aria";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";

import { Text, TooltipTrigger } from "@phoenix/components";
import { SpanKindIcon } from "@phoenix/components/trace/SpanKindIcon";
import { SpanPreviewTooltip } from "@phoenix/components/trace/SpanPreviewTooltip";
import type { ISpanItem } from "@phoenix/components/trace/types";

const TRACE_START = Date.parse("2026-09-22T09:53:23.284Z");

/**
 * Builds a span as the trace tree holds it. Offsets are relative to the
 * trace start; a `null` latency leaves the span open.
 */
function span(
  overrides: Partial<ISpanItem> & {
    id: string;
    name: string;
    spanKind: string;
    startOffsetMs: number;
    latencyMs: number | null;
  }
): ISpanItem {
  const { startOffsetMs, latencyMs, ...rest } = overrides;
  const start = new Date(TRACE_START + startOffsetMs);
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

const llmSpan = span({
  id: "llm-call",
  name: "LLM call 1: claude-fable-5-1",
  spanKind: "llm",
  startOffsetMs: 0,
  latencyMs: 3075,
  tokenCountTotal: 144604,
  costSummary: { total: { cost: 1.49 } },
});

const toolSpan = span({
  id: "tool-call",
  name: "Bash",
  spanKind: "tool",
  startOffsetMs: 3217,
  latencyMs: 6767,
});

const openSpan = span({
  id: "open-span",
  name: "agent-loop",
  spanKind: "agent",
  startOffsetMs: 0,
  latencyMs: null,
});

const errorSpan = span({
  id: "error-span",
  name: "retrieve",
  spanKind: "retriever",
  startOffsetMs: 220,
  latencyMs: 640,
  statusCode: "ERROR",
});

const longNameSpan = span({
  id: "long-name",
  name: "a-very-long-span-name-that-keeps-going-until-the-card-has-to-truncate-it",
  spanKind: "chain",
  startOffsetMs: 7000,
  latencyMs: 4900,
});

const unpricedSpan = span({
  id: "unpriced",
  name: "local-model (no pricing)",
  spanKind: "llm",
  startOffsetMs: 500,
  latencyMs: 2200,
  tokenCountTotal: 812,
});

/**
 * The breakdown the tooltip loads for the LLM span: a prompt/completion
 * split with cache reads and writes, priced. The unpriced span answers with
 * tokens alone; every other span has no breakdown.
 */
function buildSpanDetails(nodeId: string) {
  const base = { __typename: "Span", id: nodeId };
  if (nodeId === llmSpan.id) {
    return {
      ...base,
      tokenCountTotal: 144604,
      tokenCountPrompt: 144293,
      tokenCountCompletion: 311,
      costSummary: {
        total: { cost: 1.49 },
        prompt: { cost: 1.47 },
        completion: { cost: 0.02 },
      },
      costDetailSummaryEntries: [
        {
          tokenType: "input",
          isPrompt: true,
          value: { tokens: 2, cost: 0.000006 },
        },
        {
          tokenType: "cache_read",
          isPrompt: true,
          value: { tokens: 26830, cost: 0.008 },
        },
        {
          tokenType: "cache_write",
          isPrompt: true,
          value: { tokens: 117461, cost: 1.462 },
        },
        {
          tokenType: "output",
          isPrompt: false,
          value: { tokens: 311, cost: 0.02 },
        },
      ],
    };
  }
  if (nodeId === unpricedSpan.id) {
    return {
      ...base,
      tokenCountTotal: 812,
      tokenCountPrompt: 600,
      tokenCountCompletion: 212,
      costSummary: null,
      costDetailSummaryEntries: [
        {
          tokenType: "input",
          isPrompt: true,
          value: { tokens: 600, cost: null },
        },
        {
          tokenType: "output",
          isPrompt: false,
          value: { tokens: 212, cost: null },
        },
      ],
    };
  }
  return {
    ...base,
    tokenCountTotal: null,
    tokenCountPrompt: null,
    tokenCountCompletion: null,
    costSummary: null,
    costDetailSummaryEntries: [],
  };
}

/** Answers the details query from the fixtures after a short, visible delay. */
const mockRelayEnvironment = new Environment({
  network: Network.create(async (_request, variables) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { data: { node: buildSpanDetails(String(variables.nodeId)) } };
  }),
  store: new Store(new RecordSource()),
});

/** Never answers, so the tooltip keeps showing the totals it opened with. */
const pendingRelayEnvironment = new Environment({
  network: Network.create(() => new Promise(() => {})),
  store: new Store(new RecordSource()),
});

/**
 * A stand-in for a trace tree row, with the tooltip held open beside it as
 * it is in the tree. The row sits to the right so the tooltip has room, and
 * like a tree row its box starts well left of its icon: the tooltip anchors
 * to the box's edge, which every row shares, not to the icon.
 */
function OpenPreview({ span }: { span: ISpanItem }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <TooltipTrigger isOpen>
        <Focusable>
          <div
            role="button"
            tabIndex={0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: 360,
              padding: "8px 8px 8px 48px",
              border: "1px solid var(--global-border-color-default)",
              borderRadius: "var(--global-rounding-small)",
            }}
          >
            <SpanKindIcon spanKind={span.spanKind} />
            <Text>{span.name}</Text>
          </div>
        </Focusable>
        <SpanPreviewTooltip span={span} />
      </TooltipTrigger>
    </div>
  );
}

/**
 * The tooltip each trace tree row opens on hover or focus. It names the
 * span and shows when it ran, which every span has, and for spans with
 * usage lazily loads the token and cost breakdown, showing the totals the
 * row already knows until it arrives. A canned Relay environment answers
 * the breakdown after a short delay; no requests leave the story.
 */
const meta: Meta<typeof SpanPreviewTooltip> = {
  title: "Trace/SpanPreviewTooltip",
  component: SpanPreviewTooltip,
  decorators: [
    (Story) => (
      <RelayEnvironmentProvider environment={mockRelayEnvironment}>
        <Story />
      </RelayEnvironmentProvider>
    ),
  ],
  parameters: {
    width: 720,
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof SpanPreviewTooltip>;

/** An LLM span: timing, then the token and cost breakdown once loaded. */
export const LLMSpan: Story = {
  render: () => <OpenPreview span={llmSpan} />,
};

/** A local model: tokens are counted but nothing is priced. */
export const TokensWithoutCost: Story = {
  render: () => <OpenPreview span={unpricedSpan} />,
};

/** A tool span has no usage, so timing is the whole tooltip. */
export const ToolSpan: Story = {
  render: () => <OpenPreview span={toolSpan} />,
};

/** A span that has not ended yet has no end time and no latency. */
export const OpenSpan: Story = {
  render: () => <OpenPreview span={openSpan} />,
};

/** An error span carries its status beside the name. */
export const ErrorSpan: Story = {
  render: () => <OpenPreview span={errorSpan} />,
};

/** A long name truncates rather than widening the tooltip. */
export const LongName: Story = {
  render: () => <OpenPreview span={longNameSpan} />,
};

/**
 * While the breakdown is in flight the row's totals stand in, so the
 * tooltip never blanks or shows a spinner. This story's request never
 * completes.
 */
export const DetailsPending: Story = {
  decorators: [
    (Story) => (
      <RelayEnvironmentProvider environment={pendingRelayEnvironment}>
        <Story />
      </RelayEnvironmentProvider>
    ),
  ],
  render: () => <OpenPreview span={llmSpan} />,
};
