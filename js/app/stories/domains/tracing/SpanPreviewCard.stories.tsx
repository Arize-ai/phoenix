import type { Meta, StoryObj } from "@storybook/react";

import type { SpanPreviewCardProps } from "@phoenix/components/trace/SpanPreviewCard";
import { SpanPreviewCard } from "@phoenix/components/trace/SpanPreviewCard";
import type { TokenDetailsBreakdownProps } from "@phoenix/components/trace/TokenDetailsBreakdown";
import { TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH } from "@phoenix/components/trace/TokenDetailsBreakdown";

import type { SpanAnnotationFixture } from "../../constants/annotationFixtures";
import {
  annotationConfigsByName,
  spanAnnotationsBySpanId,
  summarizeSpanAnnotations,
} from "../../constants/annotationFixtures";
import { buildSpan } from "../../constants/spanFixtures";
import { OptionGrid } from "../../utils/OptionGrid";

/** A card with its breakdown loaded, from plain values. */
function loadedCard({
  annotations,
  metricsDetails = {},
  ...span
}: Parameters<typeof buildSpan>[0] & {
  annotations: readonly SpanAnnotationFixture[];
  metricsDetails?: TokenDetailsBreakdownProps;
}): SpanPreviewCardProps {
  return {
    span: buildSpan({
      ...span,
      spanAnnotationSummaries: summarizeSpanAnnotations(annotations),
    }),
    annotationConfigsByName,
    metricsDetails,
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

const draft = loadedCard({
  id: "llm-draft",
  name: "draft_answer",
  spanKind: "llm",
  startOffsetMs: 2215,
  latencyMs: 2980,
  tokenCountTotal: 4821,
  costSummary: { total: { cost: 0.0212 } },
  annotations: spanAnnotationsBySpanId["llm-draft"] ?? [],
  metricsDetails: draftMetrics,
});

const final = loadedCard({
  id: "llm-final",
  name: "final_answer",
  spanKind: "llm",
  startOffsetMs: 6620,
  latencyMs: 1790,
  tokenCountTotal: 3792,
  costSummary: { total: { cost: 0.0126 } },
  annotations: spanAnnotationsBySpanId["llm-final"] ?? [],
  metricsDetails: finalMetrics,
});

const failedTool = loadedCard({
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

const unannotated = loadedCard({
  id: "plan",
  name: "plan",
  spanKind: "llm",
  startOffsetMs: 0,
  latencyMs: 205,
  tokenCountTotal: 1300,
  costSummary: { total: { cost: 0.0038 } },
  annotations: [],
  metricsDetails: {
    tokens: { total: 1300, prompt: 1204, completion: 96 },
    costs: { total: 0.0038, prompt: 0.003, completion: 0.0008 },
  },
});

const longContent = loadedCard({
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
const manyEvals = loadedCard({
  id: "many-evals",
  name: "final_answer",
  spanKind: "llm",
  startOffsetMs: 6620,
  latencyMs: 1790,
  tokenCountTotal: 3792,
  costSummary: { total: { cost: 0.0126 } },
  metricsDetails: finalMetrics,
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

const unpriced = loadedCard({
  id: "unpriced",
  name: "local_model",
  spanKind: "llm",
  startOffsetMs: 500,
  latencyMs: 2200,
  tokenCountTotal: 812,
  annotations: [],
  metricsDetails: {
    tokens: {
      total: 812,
      prompt: 600,
      completion: 212,
      promptDetails: { input: 600 },
      completionDetails: { output: 212 },
    },
  },
});

const stillRunning = loadedCard({
  id: "still-running",
  name: "agent-loop",
  spanKind: "agent",
  startOffsetMs: 0,
  latencyMs: null,
  annotations: [],
});

const timingOnly = loadedCard({
  id: "decision",
  name: "route_request",
  spanKind: "decision",
  startOffsetMs: 180,
  latencyMs: 42,
  annotations: [],
});

/** Only the tree row's data, before the details load. */
const loading: SpanPreviewCardProps = {
  ...draft,
  metricsDetails: null,
};

function CardGrid({
  rows,
}: {
  rows: readonly { label: string; card: SpanPreviewCardProps }[];
}) {
  return (
    <OptionGrid
      rows={rows}
      cellWidth={`${TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH}px`}
      justifyCells="stretch"
      alignRows="start"
      renderCell={(row) => <SpanPreviewCard {...row.card} />}
    />
  );
}

/**
 * The content of a trace tree row's preview, rendered from plain fixtures at
 * the width it gets in its tooltip. `Span Preview Tooltip` shows the
 * connected version that loads this data, held open in the tooltip.
 */
const meta: Meta<typeof SpanPreviewCard> = {
  title: "Domains/Tracing/Span Preview Card",
  tags: ["updated", "complete", "unreviewed"],
  component: SpanPreviewCard,
  parameters: {
    layout: "centered",
    themeLayout: "column",
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof SpanPreviewCard>;

export const Default: Story = {
  tags: ["!dev"],
  parameters: {
    width: TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH,
    themeLayout: "row",
  },
  args: draft,
};

export const ContentTypes: Story = {
  name: "Content Types",
  tags: ["!dev"],
  render: () => (
    <CardGrid
      rows={[
        { label: "Flagged by evals", card: draft },
        { label: "Passed every eval", card: final },
        { label: "Failed tool call", card: failedTool },
        { label: "No annotations", card: unannotated },
        { label: "Tokens without cost", card: unpriced },
        { label: "Timing only", card: timingOnly },
        { label: "Still running", card: stillRunning },
      ]}
    />
  ),
};

export const ContentLength: Story = {
  name: "Content Length",
  tags: ["!dev"],
  render: () => (
    <CardGrid
      rows={[
        { label: "Six evals, one scored twice", card: manyEvals },
        { label: "Long names and labels", card: longContent },
      ]}
    />
  ),
};

/**
 * Annotations come with the tree row, so before the details load only the
 * breakdown waits, as a skeleton around the known totals.
 */
export const Loading: Story = {
  tags: ["!dev"],
  render: () => (
    <CardGrid
      rows={[
        { label: "Row data only", card: loading },
        { label: "Details loaded", card: draft },
      ]}
    />
  ),
};
