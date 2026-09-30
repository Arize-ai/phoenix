import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { Focusable } from "react-aria";

import {
  RichTooltip,
  Text,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { SpanKindIcon } from "@phoenix/components/trace/SpanKindIcon";
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
 * Six evals on one span, one of them scored twice, so the section's length
 * and its unfavorable-first order can be judged at a glance.
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
    ...(spanAnnotationsBySpanId["llm-final"] ?? []),
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

/** Only the tree row's data, before the details load. */
const loading: SpanPreviewCardProps = {
  ...draft,
  metricsDetails: null,
};

/** One labeled case of a stack, at the width the card gets in its tooltip. */
function Case({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        width: TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH,
      }}
    >
      <Text size="S" weight="heavy" color="text-700">
        {label}
      </Text>
      {children}
    </section>
  );
}

function Stack({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
      {children}
    </div>
  );
}

/**
 * The content of a trace tree row's preview, rendered from plain fixtures.
 * `Span Preview Tooltip` shows the connected version that loads this data.
 * Cases render inline at tooltip width; `In Tooltip` shows the dividers
 * running to the tooltip's edges.
 */
const meta: Meta<typeof SpanPreviewCard> = {
  title: "Domains/Tracing/Span Preview Card",
  tags: ["updated", "complete", "unreviewed"],
  component: SpanPreviewCard,
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof SpanPreviewCard>;

export const Default: Story = {
  tags: ["!dev"],
  parameters: { width: TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH },
  args: draft,
};

/** The shapes a span takes once its details load, unfavorable results first. */
export const ContentTypes: Story = {
  name: "Content Types",
  tags: ["!dev"],
  parameters: { themeLayout: "row" },
  render: () => (
    <Stack>
      <Case label="Flagged by evals">
        <SpanPreviewCard {...draft} />
      </Case>
      <Case label="Passed every eval">
        <SpanPreviewCard {...final} />
      </Case>
      <Case label="Failed tool call, no usage">
        <SpanPreviewCard {...failedTool} />
      </Case>
      <Case label="No annotations">
        <SpanPreviewCard {...unannotated} />
      </Case>
    </Stack>
  ),
};

export const ContentLength: Story = {
  name: "Content Length",
  tags: ["!dev"],
  parameters: { themeLayout: "row" },
  render: () => (
    <Stack>
      <Case label="Six evals, one scored twice">
        <SpanPreviewCard {...manyEvals} />
      </Case>
      <Case label="Long names and labels">
        <SpanPreviewCard {...longContent} />
      </Case>
    </Stack>
  ),
};

/**
 * Annotations come with the tree row, so before the details load only the
 * breakdown waits, as a skeleton around the known totals. The loaded card
 * follows for comparison.
 */
export const Loading: Story = {
  tags: ["!dev"],
  parameters: { themeLayout: "row" },
  render: () => (
    <Stack>
      <Case label="Row data only">
        <SpanPreviewCard {...loading} />
      </Case>
      <Case label="Details loaded">
        <SpanPreviewCard {...draft} />
      </Case>
    </Stack>
  ),
};

/**
 * Held open in the rich tooltip a tree row opens, where dividers run to the
 * tooltip's edges.
 */
export const InTooltip: Story = {
  name: "In Tooltip",
  tags: ["!dev"],
  parameters: { themeLayout: "row" },
  render: () => (
    // The open tooltip is portaled and takes no layout space, so reserve
    // room for it beside the row.
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        width: TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH + 320,
        height: 640,
      }}
    >
      <TooltipTrigger isOpen>
        <Focusable>
          <div
            role="button"
            tabIndex={0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: "fit-content",
              padding: "8px 16px",
            }}
          >
            <SpanKindIcon spanKind={draft.span.spanKind} />
            <Text>{draft.span.name}</Text>
          </div>
        </Focusable>
        <RichTooltip
          placement="left top"
          width={TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH}
        >
          <TooltipArrow />
          <SpanPreviewCard {...draft} />
        </RichTooltip>
      </TooltipTrigger>
    </div>
  ),
};
