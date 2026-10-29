import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";

import type {
  TokenDetailsBreakdownProps,
  TokenDetailTotals,
} from "@phoenix/components/trace/TokenDetailsBreakdown";
import { TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH } from "@phoenix/components/trace/TokenDetailsBreakdown";
import type { SessionTurnPreviewTurn } from "@phoenix/pages/trace/SessionTurnPreviewCard";
import { SessionTurnPreviewCard } from "@phoenix/pages/trace/SessionTurnPreviewCard";
import { SessionTurnPreviewTooltip } from "@phoenix/pages/trace/SessionTurnPreviewTooltip";

import type { SpanAnnotationFixture } from "../../constants/annotationFixtures";
import {
  annotationConfigsByName,
  summarizeSpanAnnotations,
} from "../../constants/annotationFixtures";
import { HeldOpenTooltip } from "../../utils/HeldOpenTooltip";
import { OptionGrid } from "../../utils/OptionGrid";

type TurnCase = {
  turn: SessionTurnPreviewTurn;
  /** The token and cost split the turn's usage query returns. */
  usage: TokenDetailsBreakdownProps;
};

const SESSION_START_MS = Date.parse("2026-10-27T15:04:12.000Z");

/** A turn and the usage its breakdown loads, from plain values. */
function buildTurnCase({
  index,
  startOffsetMs,
  latencyMs,
  traceAnnotations = [],
  rootSpanAnnotations = [],
  usage = {},
  ...turn
}: Pick<SessionTurnPreviewTurn, "name"> &
  Partial<
    Pick<SessionTurnPreviewTurn, "statusCode" | "tokenCountTotal" | "costTotal">
  > & {
    index: number;
    startOffsetMs: number;
    latencyMs: number | null;
    traceAnnotations?: readonly SpanAnnotationFixture[];
    rootSpanAnnotations?: readonly SpanAnnotationFixture[];
    usage?: TokenDetailsBreakdownProps;
  }): TurnCase {
  const traceId = `trace-${index}`;
  const startMs = SESSION_START_MS + startOffsetMs;
  return {
    turn: {
      traceId,
      traceNodeId: btoa(`Trace:${index}`),
      indexLabel: String(index).padStart(2, "0"),
      statusCode: "OK",
      tokenCountTotal: null,
      costTotal: null,
      ...turn,
      startTime: new Date(startMs).toISOString(),
      endTime:
        latencyMs == null ? null : new Date(startMs + latencyMs).toISOString(),
      latencyMs,
      traceAnnotationSummaries: summarizeSpanAnnotations(traceAnnotations),
      rootSpanAnnotationSummaries:
        summarizeSpanAnnotations(rootSpanAnnotations),
    },
    usage,
  };
}

const flagged = buildTurnCase({
  index: 3,
  name: "Where is my order #4471?",
  startOffsetMs: 48200,
  latencyMs: 6410,
  tokenCountTotal: 8613,
  costTotal: 0.0338,
  traceAnnotations: [
    { name: "user_feedback", label: "negative", score: 0 },
    { name: "qa_correctness", label: "incorrect", score: 0 },
  ],
  rootSpanAnnotations: [
    { name: "hallucination", label: "hallucinated", score: 1 },
    { name: "faithfulness", label: null, score: 0.31 },
  ],
  usage: {
    tokens: {
      total: 8613,
      prompt: 6861,
      completion: 1752,
      promptDetails: { input: 5646, cache_read: 1215 },
      completionDetails: { output: 1752 },
    },
    costs: {
      total: 0.0338,
      prompt: 0.0172,
      completion: 0.0166,
      promptDetails: { input: 0.0166, cache_read: 0.0006 },
      completionDetails: { output: 0.0166 },
    },
  },
});

const passed = buildTurnCase({
  index: 1,
  name: "Can I change my shipping address?",
  startOffsetMs: 0,
  latencyMs: 2390,
  tokenCountTotal: 3792,
  costTotal: 0.0126,
  traceAnnotations: [{ name: "user_feedback", label: "positive", score: 1 }],
  rootSpanAnnotations: [
    { name: "hallucination", label: "factual", score: 0 },
    { name: "faithfulness", label: null, score: 0.97 },
  ],
  usage: {
    tokens: { total: 3792, prompt: 3390, completion: 402 },
    costs: { total: 0.0126, prompt: 0.0085, completion: 0.0041 },
  },
});

const failed = buildTurnCase({
  index: 4,
  name: "Cancel it then",
  statusCode: "ERROR",
  startOffsetMs: 71900,
  latencyMs: 605,
  tokenCountTotal: 1300,
  costTotal: 0.0038,
  rootSpanAnnotations: [{ name: "qa_correctness", label: null, score: 0 }],
  usage: {
    tokens: { total: 1300, prompt: 1204, completion: 96 },
    costs: { total: 0.0038, prompt: 0.003, completion: 0.0008 },
  },
});

const traceEvalsOnly = buildTurnCase({
  index: 2,
  name: "Thanks, that worked",
  startOffsetMs: 21400,
  latencyMs: 980,
  tokenCountTotal: 2104,
  costTotal: 0.0061,
  traceAnnotations: [
    { name: "user_feedback", label: "positive", score: 1 },
    { name: "tone", label: "formal", score: null },
  ],
  usage: {
    tokens: { total: 2104, prompt: 1980, completion: 124 },
    costs: { total: 0.0061, prompt: 0.005, completion: 0.0011 },
  },
});

const unannotated = buildTurnCase({
  index: 5,
  name: "What are your opening hours?",
  startOffsetMs: 90300,
  latencyMs: 1460,
  tokenCountTotal: 2480,
  costTotal: 0.0072,
  usage: {
    tokens: { total: 2480, prompt: 2290, completion: 190 },
    costs: { total: 0.0072, prompt: 0.0057, completion: 0.0015 },
  },
});

const unpriced = buildTurnCase({
  index: 6,
  name: "Summarize our conversation",
  startOffsetMs: 120500,
  latencyMs: 2200,
  tokenCountTotal: 812,
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

const timingOnly = buildTurnCase({
  index: 7,
  name: "route_request",
  startOffsetMs: 140100,
  latencyMs: 42,
});

const stillRunning = buildTurnCase({
  index: 8,
  name: "Book me a return pickup",
  startOffsetMs: 151700,
  latencyMs: null,
});

const longContent = buildTurnCase({
  index: 12,
  name: "I ordered two of the large ceramic planters last week and only one arrived, and the tracking page still says the second is out for delivery",
  startOffsetMs: 402800,
  latencyMs: 12400,
  traceAnnotations: [
    {
      name: "answer-completeness-against-reference",
      label: "partially-complete-with-omissions",
      score: 0.5,
    },
  ],
  rootSpanAnnotations: [
    {
      name: "release_review",
      label: "needs-another-pass-before-release",
      score: null,
    },
  ],
});

const manyEvals = buildTurnCase({
  index: 9,
  name: "Why was I charged twice?",
  startOffsetMs: 188000,
  latencyMs: 4720,
  tokenCountTotal: 6233,
  costTotal: 0.0214,
  traceAnnotations: [
    { name: "user_feedback", label: "negative", score: 0 },
    { name: "user_feedback", label: "positive", score: 1 },
    { name: "qa_correctness", label: "incorrect", score: 0 },
    { name: "relevance", label: "relevant", score: 1 },
  ],
  rootSpanAnnotations: [
    { name: "hallucination", label: "factual", score: 0 },
    { name: "faithfulness", label: null, score: 0.73 },
    { name: "toxicity", label: null, score: 0.41 },
    { name: "context_precision", label: null, score: 0.22 },
  ],
  usage: {
    tokens: { total: 6233, prompt: 5610, completion: 623 },
    costs: { total: 0.0214, prompt: 0.014, completion: 0.0074 },
  },
});

function detailEntries(
  totals: TokenDetailTotals | null | undefined,
  valueKey: "tokens" | "cost"
) {
  const side = (
    details: TokenDetailTotals["promptDetails"],
    isPrompt: boolean
  ) =>
    Object.entries(details ?? {}).map(([tokenType, value]) => ({
      tokenType,
      isPrompt,
      value: { [valueKey]: value },
    }));
  return [
    ...side(totals?.promptDetails, true),
    ...side(totals?.completionDetails, false),
  ];
}

/** The usage query's response for a turn, as the server would send it. */
function usageResponse({ turn, usage: { tokens, costs } }: TurnCase) {
  return {
    node: {
      __typename: "Trace",
      id: turn.traceNodeId,
      rootSpan: tokens
        ? {
            id: `${turn.traceNodeId}:root`,
            cumulativeTokenCountTotal: tokens.total ?? null,
            cumulativeTokenCountPrompt: tokens.prompt ?? null,
            cumulativeTokenCountCompletion: tokens.completion ?? null,
            cumulativeCostDetailSummaryEntries: detailEntries(tokens, "tokens"),
          }
        : null,
      costSummary: {
        total: { cost: costs?.total ?? null },
        prompt: { cost: costs?.prompt ?? null },
        completion: { cost: costs?.completion ?? null },
      },
      costDetailSummaryEntries: detailEntries(costs, "cost"),
    },
  };
}

type UsageOutcome = "loaded" | "pending" | "failed";

function createRelayEnvironment(
  turnCase: TurnCase,
  outcome: UsageOutcome,
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
      return { data: usageResponse(turnCase) };
    }),
    store: new Store(new RecordSource()),
  });
}

/**
 * A turn's preview held open, as it opens to the right of a turn row. Its
 * usage query is answered in the story, so no requests leave it.
 */
function OpenPreview({
  turnCase,
  outcome = "loaded",
  delayMs = 0,
  height,
}: {
  turnCase: TurnCase;
  outcome?: UsageOutcome;
  delayMs?: number;
  height: number;
}) {
  const [environment] = useState(() =>
    createRelayEnvironment(turnCase, outcome, delayMs)
  );
  return (
    <RelayEnvironmentProvider environment={environment}>
      <HeldOpenTooltip
        opens="right"
        width={TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH}
        height={height}
      >
        <SessionTurnPreviewTooltip
          turn={turnCase.turn}
          annotationConfigsByName={annotationConfigsByName}
        />
      </HeldOpenTooltip>
    </RelayEnvironmentProvider>
  );
}

type PreviewRow = {
  label: string;
  turnCase: TurnCase;
  outcome?: UsageOutcome;
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
          turnCase={row.turnCase}
          outcome={row.outcome}
          height={row.height}
        />
      )}
    />
  );
}

/**
 * The tooltip each session turn row opens on hover or keyboard focus. It
 * shows the turn's name and status, timing, the trace's and the root span's
 * evals, and the token and cost breakdown. The breakdown loads once the
 * tooltip has settled, while everything else comes with the turn list and
 * shows at once. A turn with no usage has nothing to load.
 *
 * The tooltip's content is `SessionTurnPreviewCard`, which production
 * renders only inside this tooltip. React Aria positions a tooltip against
 * the viewport and offers no other boundary, so each story renders in a
 * frame of its own on this page.
 */
const meta: Meta<typeof SessionTurnPreviewTooltip> = {
  title: "Domains/Tracing/Session Turn Preview",
  tags: ["updated", "complete", "unreviewed"],
  component: SessionTurnPreviewTooltip,
  subcomponents: { SessionTurnPreviewCard },
  parameters: {
    layout: "centered",
    themeLayout: "column",
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof SessionTurnPreviewTooltip>;

const DEFAULT_HEIGHT = 580;

/** The breakdown loads after a short delay. */
export const Default: Story = {
  tags: ["!dev"],
  parameters: docsFrame([DEFAULT_HEIGHT]),
  render: () => (
    <OpenPreview turnCase={flagged} delayMs={600} height={DEFAULT_HEIGHT} />
  ),
};

const contentTypeRows: PreviewRow[] = [
  { label: "Flagged by evals", turnCase: flagged, height: 580 },
  { label: "Passed every eval", turnCase: passed, height: 510 },
  { label: "Failed turn", turnCase: failed, height: 410 },
  { label: "Trace evals only", turnCase: traceEvalsOnly, height: 440 },
  { label: "No evals", turnCase: unannotated, height: 340 },
  { label: "Tokens without cost", turnCase: unpriced, height: 310 },
  { label: "Timing only", turnCase: timingOnly, height: 120 },
  { label: "Still running", turnCase: stillRunning, height: 120 },
];

export const ContentTypes: Story = {
  name: "Content Types",
  tags: ["!dev"],
  parameters: docsFrame(contentTypeRows.map((row) => row.height)),
  render: () => <PreviewGrid rows={contentTypeRows} />,
};

const contentLengthRows: PreviewRow[] = [
  {
    label: "More than two evals per group",
    turnCase: manyEvals,
    height: 590,
  },
  { label: "Long name and labels", turnCase: longContent, height: 290 },
];

export const ContentLength: Story = {
  name: "Content Length",
  tags: ["!dev"],
  parameters: docsFrame(contentLengthRows.map((row) => row.height)),
  render: () => <PreviewGrid rows={contentLengthRows} />,
};

const loadingRows: PreviewRow[] = [
  {
    label: "Breakdown pending",
    turnCase: flagged,
    outcome: "pending",
    height: 580,
  },
  { label: "Breakdown loaded", turnCase: flagged, height: 580 },
];

/**
 * Evals come with the turn list, so while the breakdown is in flight only
 * it waits, as a skeleton around the turn's known totals. The pending
 * request never completes.
 */
export const Loading: Story = {
  tags: ["!dev"],
  parameters: docsFrame(loadingRows.map((row) => row.height)),
  render: () => <PreviewGrid rows={loadingRows} />,
};

const loadFailedRows: PreviewRow[] = [
  {
    label: "Tokens and cost",
    turnCase: flagged,
    outcome: "failed",
    height: 580,
  },
  { label: "Tokens only", turnCase: unpriced, outcome: "failed", height: 320 },
];

/**
 * When the breakdown fails to load, an `error` label takes its place under
 * its heading, which names the measures the turn's totals hold, and the
 * rest of the preview stays. Hovering the label shows the request's error
 * message.
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
  render: () => <OpenPreview turnCase={flagged} height={DEFAULT_HEIGHT} />,
};
