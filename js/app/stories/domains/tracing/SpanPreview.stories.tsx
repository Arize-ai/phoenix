import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";

import { SpanPreviewCard } from "@phoenix/components/trace/SpanPreviewCard";
import { SpanPreviewTooltip } from "@phoenix/components/trace/SpanPreviewTooltip";
import type {
  TokenDetailsBreakdownProps,
  TokenDetailTotals,
} from "@phoenix/components/trace/TokenDetailsBreakdown";
import { TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH } from "@phoenix/components/trace/TokenDetailsBreakdown";
import type { ISpanItem } from "@phoenix/components/trace/types";

import type { SpanAnnotationFixture } from "../../constants/annotationFixtures";
import {
  annotationConfigsByName,
  spanAnnotationsBySpanId,
  summarizeSpanAnnotations,
} from "../../constants/annotationFixtures";
import { buildSpan } from "../../constants/spanFixtures";
import { HeldOpenTooltip } from "../../utils/HeldOpenTooltip";
import { OptionGrid } from "../../utils/OptionGrid";

type SpanCase = {
  span: ISpanItem;
  /** The token and cost split the span's details query returns. */
  usage: TokenDetailsBreakdownProps;
};

/** A span and the usage its breakdown loads, from plain values. */
function buildSpanCase({
  annotations,
  usage = {},
  ...span
}: Parameters<typeof buildSpan>[0] & {
  annotations: readonly SpanAnnotationFixture[];
  usage?: TokenDetailsBreakdownProps;
}): SpanCase {
  return {
    span: buildSpan({
      ...span,
      spanAnnotationSummaries: summarizeSpanAnnotations(annotations),
    }),
    usage,
  };
}

const draftMetrics: TokenDetailsBreakdownProps = {
  tokens: {
    total: 4821,
    prompt: 3471,
    completion: 1350,
    promptDetails: { input: 2256, cache_read: 1215 },
    completionDetails: { output: 1350 },
  },
  costs: {
    total: 0.0212,
    prompt: 0.0087,
    completion: 0.0125,
    promptDetails: { input: 0.0081, cache_read: 0.0006 },
    completionDetails: { output: 0.0125 },
  },
};

const finalMetrics: TokenDetailsBreakdownProps = {
  tokens: { total: 3792, prompt: 3390, completion: 402 },
  costs: { total: 0.0126, prompt: 0.0085, completion: 0.0041 },
};

const draft = buildSpanCase({
  id: "llm-draft",
  name: "draft_answer",
  spanKind: "llm",
  startOffsetMs: 2215,
  latencyMs: 2980,
  tokenCountTotal: 4821,
  costSummary: { total: { cost: 0.0212 } },
  annotations: spanAnnotationsBySpanId["llm-draft"] ?? [],
  usage: draftMetrics,
});

const final = buildSpanCase({
  id: "llm-final",
  name: "final_answer",
  spanKind: "llm",
  startOffsetMs: 6620,
  latencyMs: 1790,
  tokenCountTotal: 3792,
  costSummary: { total: { cost: 0.0126 } },
  annotations: spanAnnotationsBySpanId["llm-final"] ?? [],
  usage: finalMetrics,
});

const failedTool = buildSpanCase({
  id: "lookup-order",
  name: "lookup_order",
  spanKind: "tool",
  statusCode: "ERROR",
  startOffsetMs: 210,
  latencyMs: 605,
  annotations: [
    {
      name: "tool_success",
      label: "fail",
      score: 0,
    },
  ],
});

const unannotated = buildSpanCase({
  id: "plan",
  name: "plan",
  spanKind: "llm",
  startOffsetMs: 0,
  latencyMs: 205,
  tokenCountTotal: 1300,
  costSummary: { total: { cost: 0.0038 } },
  annotations: [],
  usage: {
    tokens: { total: 1300, prompt: 1204, completion: 96 },
    costs: { total: 0.0038, prompt: 0.003, completion: 0.0008 },
  },
});

const longContent = buildSpanCase({
  id: "long-content",
  name: "answer_completeness_against_reference_with_a_very_long_span_name",
  spanKind: "chain",
  startOffsetMs: 0,
  latencyMs: 12400,
  annotations: [
    {
      name: "answer-completeness-against-reference",
      label: "partially-complete-with-omissions",
      score: 0.5,
    },
    {
      name: "faithfulness",
      label: null,
      score: 0.62,
    },
    {
      name: "release_review",
      label: "needs-another-pass-before-release",
      score: null,
    },
  ],
});

/**
 * Six evals on one span, one of them scored twice, with scores spread across
 * each config's range so the section's length, its unfavorable-first order
 * and its graded colors can be judged at a glance.
 */
const manyEvals = buildSpanCase({
  id: "many-evals",
  name: "final_answer",
  spanKind: "llm",
  startOffsetMs: 6620,
  latencyMs: 1790,
  tokenCountTotal: 3792,
  costSummary: { total: { cost: 0.0126 } },
  usage: finalMetrics,
  annotations: [
    {
      name: "hallucination",
      label: "factual",
      score: 0,
    },
    {
      name: "faithfulness",
      label: null,
      score: 0.73,
    },
    {
      name: "toxicity",
      label: null,
      score: 0.41,
    },
    {
      name: "context_precision",
      label: null,
      score: 0.22,
    },
    {
      name: "qa_correctness",
      label: "incorrect",
      score: 0,
    },
    {
      name: "user_feedback",
      label: "negative",
      score: 0,
    },
    {
      name: "user_feedback",
      label: "positive",
      score: 1,
    },
  ],
});

const unpriced = buildSpanCase({
  id: "unpriced",
  name: "local_model",
  spanKind: "llm",
  startOffsetMs: 500,
  latencyMs: 2200,
  tokenCountTotal: 812,
  annotations: [],
  usage: {
    tokens: {
      total: 812,
      prompt: 600,
      completion: 212,
      promptDetails: { input: 600 },
      completionDetails: { output: 212 },
    },
  },
});

const stillRunning = buildSpanCase({
  id: "still-running",
  name: "agent-loop",
  spanKind: "agent",
  startOffsetMs: 0,
  latencyMs: null,
  annotations: [],
});

const timingOnly = buildSpanCase({
  id: "decision",
  name: "route_request",
  spanKind: "decision",
  startOffsetMs: 180,
  latencyMs: 42,
  annotations: [],
});

/** The span's cost detail entries, one per token type and side. */
function costDetailEntries({ tokens, costs }: TokenDetailsBreakdownProps) {
  const side = (isPrompt: boolean) => {
    const key = isPrompt ? "promptDetails" : "completionDetails";
    const tokenTypes = new Set([
      ...Object.keys(tokens?.[key] ?? {}),
      ...Object.keys(costs?.[key] ?? {}),
    ]);
    return [...tokenTypes].map((tokenType) => ({
      tokenType,
      isPrompt,
      value: {
        tokens: tokens?.[key]?.[tokenType] ?? null,
        cost: costs?.[key]?.[tokenType] ?? null,
      },
    }));
  };
  return [...side(true), ...side(false)];
}

function costOf(totals: TokenDetailTotals | null | undefined) {
  return {
    total: { cost: totals?.total ?? null },
    prompt: { cost: totals?.prompt ?? null },
    completion: { cost: totals?.completion ?? null },
  };
}

/** The details query's response for a span, as the server would send it. */
function detailsResponse({ span, usage }: SpanCase) {
  return {
    node: {
      __typename: "Span",
      id: span.id,
      tokenCountTotal: usage.tokens?.total ?? null,
      tokenCountPrompt: usage.tokens?.prompt ?? null,
      tokenCountCompletion: usage.tokens?.completion ?? null,
      costSummary: costOf(usage.costs),
      costDetailSummaryEntries: costDetailEntries(usage),
    },
  };
}

type DetailsOutcome = "loaded" | "pending" | "failed";

function createRelayEnvironment(
  spanCase: SpanCase,
  outcome: DetailsOutcome,
  delayMs: number
) {
  return new Environment({
    network: Network.create(async () => {
      if (outcome === "pending") {
        return new Promise(() => {});
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (outcome === "failed") {
        throw new TypeError("Failed to fetch");
      }
      return { data: detailsResponse(spanCase) };
    }),
    store: new Store(new RecordSource()),
  });
}

/**
 * A span's preview held open, as it opens to the left of a tree row. Its
 * details query is answered in the story, so no requests leave it.
 */
function OpenPreview({
  spanCase,
  outcome = "loaded",
  delayMs = 0,
  height,
}: {
  spanCase: SpanCase;
  outcome?: DetailsOutcome;
  delayMs?: number;
  height: number;
}) {
  const [environment] = useState(() =>
    createRelayEnvironment(spanCase, outcome, delayMs)
  );
  return (
    <RelayEnvironmentProvider environment={environment}>
      <HeldOpenTooltip
        opens="left"
        width={TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH}
        height={height}
      >
        <SpanPreviewTooltip
          span={spanCase.span}
          annotationConfigsByName={annotationConfigsByName}
        />
      </HeldOpenTooltip>
    </RelayEnvironmentProvider>
  );
}

type PreviewRow = {
  label: string;
  spanCase: SpanCase;
  outcome?: DetailsOutcome;
  /** The room the open tooltip takes. */
  height: number;
};

/** The vertical space between `OptionGrid` rows, and around both themes. */
const GRID_ROW_GAP = 24;
const THEME_CHROME = 128;

/** A Docs frame tall enough for both themes' stacks of open tooltips. */
function docsFrame(heights: readonly number[]) {
  const stack = heights.reduce((sum, height) => sum + height + GRID_ROW_GAP, 0);
  return {
    docs: { story: { inline: false, height: `${stack * 2 + THEME_CHROME}px` } },
  };
}

function PreviewGrid({ rows }: { rows: readonly PreviewRow[] }) {
  return (
    <OptionGrid
      rows={rows}
      alignRows="start"
      renderCell={(row) => (
        <OpenPreview
          spanCase={row.spanCase}
          outcome={row.outcome}
          height={row.height}
        />
      )}
    />
  );
}

/**
 * The tooltip each trace tree row opens: the span's name, kind and status,
 * timing, its evals, and the token and cost breakdown. The breakdown loads
 * once the tooltip has settled, while everything else comes with the tree
 * row and shows at once. A span with no usage has nothing to load.
 *
 * The tooltip's content is `SpanPreviewCard`, which production renders only
 * inside this tooltip. React Aria positions a tooltip against the viewport
 * and offers no other boundary, so each story renders in a frame of its own
 * on this page.
 */
const meta: Meta<typeof SpanPreviewTooltip> = {
  title: "Domains/Tracing/Span Preview",
  tags: ["updated", "complete", "unreviewed"],
  component: SpanPreviewTooltip,
  subcomponents: { SpanPreviewCard },
  parameters: {
    layout: "centered",
    themeLayout: "column",
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof SpanPreviewTooltip>;

const DEFAULT_HEIGHT = 550;

/** The breakdown loads after a short delay. */
export const Default: Story = {
  tags: ["!dev"],
  parameters: docsFrame([DEFAULT_HEIGHT]),
  render: () => (
    <OpenPreview spanCase={draft} delayMs={600} height={DEFAULT_HEIGHT} />
  ),
};

const contentTypeRows: PreviewRow[] = [
  { label: "Flagged by evals", spanCase: draft, height: 550 },
  { label: "Passed every eval", spanCase: final, height: 510 },
  { label: "Failed tool call", spanCase: failedTool, height: 200 },
  { label: "No annotations", spanCase: unannotated, height: 380 },
  { label: "Tokens without cost", spanCase: unpriced, height: 350 },
  { label: "Timing only", spanCase: timingOnly, height: 120 },
  { label: "Still running", spanCase: stillRunning, height: 120 },
];

export const ContentTypes: Story = {
  name: "Content Types",
  tags: ["!dev"],
  parameters: docsFrame(contentTypeRows.map((row) => row.height)),
  render: () => <PreviewGrid rows={contentTypeRows} />,
};

const contentLengthRows: PreviewRow[] = [
  { label: "Six evals, one scored twice", spanCase: manyEvals, height: 610 },
  { label: "Long names and labels", spanCase: longContent, height: 260 },
];

export const ContentLength: Story = {
  name: "Content Length",
  tags: ["!dev"],
  parameters: docsFrame(contentLengthRows.map((row) => row.height)),
  render: () => <PreviewGrid rows={contentLengthRows} />,
};

const loadingRows: PreviewRow[] = [
  {
    label: "Details pending",
    spanCase: draft,
    outcome: "pending",
    height: 550,
  },
  { label: "Details loaded", spanCase: draft, height: 550 },
];

/**
 * Annotations come with the tree row, so while the details are in flight
 * only the breakdown waits, as a skeleton around the span's known totals.
 * The pending request never completes.
 */
export const Loading: Story = {
  tags: ["!dev"],
  parameters: docsFrame(loadingRows.map((row) => row.height)),
  render: () => <PreviewGrid rows={loadingRows} />,
};

const loadFailedRows: PreviewRow[] = [
  {
    label: "Tokens and cost",
    spanCase: draft,
    outcome: "failed",
    height: 550,
  },
  { label: "Tokens only", spanCase: unpriced, outcome: "failed", height: 350 },
];

/**
 * When the details fail to load, an `error` label takes the breakdown's
 * place under its heading, which names the measures the span's totals hold,
 * and the rest of the preview stays. Hovering the label shows the request's
 * error message.
 */
export const LoadFailed: Story = {
  name: "Load Failed",
  tags: ["!dev"],
  parameters: docsFrame(loadFailedRows.map((row) => row.height)),
  render: () => <PreviewGrid rows={loadFailedRows} />,
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  parameters: { thumbnail: { scale: 0.4 } },
  render: () => <OpenPreview spanCase={draft} height={DEFAULT_HEIGHT} />,
};
