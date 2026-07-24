import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

import { Flex, Icon, Icons, LinkButton } from "@phoenix/components";
import { AnnotationSummaryGroupStacksRow } from "@phoenix/components/annotation/AnnotationSummaryGroup";
import type { SpanStatusCodeType } from "@phoenix/components/trace/types";
import {
  Summary,
  SummaryValue,
} from "@phoenix/pages/project/AnnotationSummary";
import {
  TraceHeaderContent,
  type TraceHeaderCostSummary,
} from "@phoenix/pages/trace/TraceDetails";

import { DetailPanelExamples } from "./detailPanelStoryHelpers";

type AnnotationSummaryFixture = {
  name: string;
  meanScore?: number;
  labelFractions?: readonly { label: string; fraction: number }[];
  count?: number;
  scoreCount?: number;
  labelCount?: number;
};

const SANE_COST_SUMMARY: TraceHeaderCostSummary = {
  prompt: { cost: 0.0082 },
  completion: { cost: 0.0041 },
  total: { cost: 0.0123 },
};

const METRIC_ANNOTATIONS: AnnotationSummaryFixture[] = [
  { name: "correctness", meanScore: 0.91 },
  {
    name: "user feedback",
    labelFractions: [
      { label: "positive", fraction: 0.82 },
      { label: "negative", fraction: 0.18 },
    ],
  },
];

const WACKY_ROOT_SPAN_ANNOTATIONS: AnnotationSummaryFixture[] = [
  {
    name: "root span correctness with a preposterously long evaluator name 🚀",
    meanScore: 9_007_199_254_740_991,
    count: 999_999_999,
    scoreCount: 999_999_999,
  },
  {
    name: "root span user feedback",
    meanScore: -123_456.789,
    labelFractions: [
      { label: "spectacular", fraction: 0.333_333 },
      { label: "haunting", fraction: 0.222_222 },
      { label: "needs more cowbell", fraction: 0.111_111 },
      { label: "🤯🤯🤯", fraction: 0.333_334 },
    ],
    count: 123_456_789,
    scoreCount: 123_456_789,
    labelCount: 123_456_789,
  },
];

const WACKY_TRACE_ANNOTATIONS: AnnotationSummaryFixture[] = [
  {
    name: "trace-level evaluator / unicode / 火の鳥 / 🧪",
    meanScore: 0.000_000_000_000_001,
    count: 1,
    scoreCount: 1,
  },
  {
    name: "a categorical distribution with far too many possible outcomes",
    labelFractions: [
      { label: "alpha", fraction: 0.4 },
      { label: "beta", fraction: 0.2 },
      { label: "gamma", fraction: 0.15 },
      { label: "delta", fraction: 0.1 },
      { label: "epsilon", fraction: 0.07 },
      { label: "zeta", fraction: 0.04 },
      { label: "something much longer than a normal label", fraction: 0.04 },
    ],
    count: 42_424_242,
    labelCount: 42_424_242,
  },
];

const LATENCY_PERMUTATIONS = [
  { name: "missing", latencyMs: null },
  { name: "zero", latencyMs: 0 },
  { name: "sane", latencyMs: 1842 },
  { name: "slow", latencyMs: 45_321 },
  { name: "oversized", latencyMs: 31_536_000_000 },
] as const;

const COST_PERMUTATIONS: ReadonlyArray<{
  name: string;
  costSummary?: TraceHeaderCostSummary;
}> = [
  { name: "missing" },
  {
    name: "zero",
    costSummary: {
      prompt: { cost: 0 },
      completion: { cost: 0 },
      total: { cost: 0 },
    },
  },
  { name: "sane", costSummary: SANE_COST_SUMMARY },
  {
    name: "high precision",
    costSummary: {
      prompt: { cost: 0.000_000_041_152 },
      completion: { cost: 0.000_000_082_304 },
      total: { cost: 0.000_000_123_456 },
    },
  },
  {
    name: "oversized",
    costSummary: {
      prompt: { cost: 333_333_333.33 },
      completion: { cost: 654_320_987.79 },
      total: { cost: 987_654_321.12 },
    },
  },
];

const annotationNames = [
  "correctness",
  "quality",
  "user feedback",
  "groundedness",
  "relevance",
  "toxicity",
  "helpfulness",
  "coherence",
  "conciseness",
  "safety",
  "style",
  "completeness",
] as const;

function getAnnotationFixtures(count: number): AnnotationSummaryFixture[] {
  return annotationNames.slice(0, count).map((name, index) => {
    if (index % 3 === 0) {
      return { name, meanScore: 0.72 + index / 100 };
    }
    if (index % 3 === 1) {
      return {
        name,
        labelFractions: [
          { label: "pass", fraction: 0.8 },
          { label: "fail", fraction: 0.2 },
        ],
      };
    }
    return {
      name,
      meanScore: 0.91,
      labelFractions: [
        { label: "positive", fraction: 0.75 },
        { label: "negative", fraction: 0.25 },
      ],
    };
  });
}

function AnnotationSummaries({
  annotations,
}: {
  annotations: readonly AnnotationSummaryFixture[];
}) {
  if (annotations.length === 0) {
    return null;
  }
  return (
    <AnnotationSummaryGroupStacksRow leadingDivider>
      {annotations.map((annotation) => (
        <Summary key={annotation.name} name={annotation.name}>
          <SummaryValue
            name={annotation.name}
            meanScore={annotation.meanScore}
            labelFractions={annotation.labelFractions}
            count={annotation.count ?? 7}
            scoreCount={
              annotation.scoreCount ?? (annotation.meanScore == null ? 0 : 7)
            }
            labelCount={
              annotation.labelCount ??
              (annotation.labelFractions == null ? 0 : 7)
            }
            disableAnimation
          />
        </Summary>
      ))}
    </AnnotationSummaryGroupStacksRow>
  );
}

function TraceHeaderExample({
  statusCode,
  annotationCount,
}: {
  statusCode: SpanStatusCodeType;
  annotationCount: number;
}) {
  const annotations = getAnnotationFixtures(annotationCount);
  const annotationSummaries: ReactNode = (
    <AnnotationSummaries annotations={annotations} />
  );
  return (
    <TraceHeaderContent
      statusCode={statusCode}
      latencyMs={1842}
      costSummary={SANE_COST_SUMMARY}
      annotationSummaries={annotationSummaries}
    />
  );
}

function getMiscellaneousAnnotationSummaries({
  rootSpanState,
}: {
  rootSpanState: "unavailable" | "without-annotations" | "with-annotations";
}) {
  const traceAnnotations =
    rootSpanState === "with-annotations"
      ? WACKY_TRACE_ANNOTATIONS
      : METRIC_ANNOTATIONS;
  return (
    <Flex
      direction="row"
      gap="size-400"
      alignItems="stretch"
      alignSelf="stretch"
    >
      {rootSpanState === "with-annotations" ? (
        <AnnotationSummaries annotations={WACKY_ROOT_SPAN_ANNOTATIONS} />
      ) : null}
      <AnnotationSummaries annotations={traceAnnotations} />
    </Flex>
  );
}

const sessionAction = (
  <LinkButton
    size="S"
    variant="primary"
    leadingVisual={<Icon svg={<Icons.MessagesSquare />} />}
    to="/projects/storybook-project/sessions/storybook-session"
  >
    View Session
  </LinkButton>
);

const meta = {
  title: "Detail panel/Trace header",
  component: TraceHeaderContent,
  parameters: {
    width: "overflow",
  },
} satisfies Meta<typeof TraceHeaderContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StatusAndAnnotationCounts: Story = {
  args: {
    statusCode: "OK",
    latencyMs: 1842,
    costSummary: SANE_COST_SUMMARY,
  },
  render: () => (
    <DetailPanelExamples>
      <TraceHeaderExample statusCode="OK" annotationCount={0} />
      <TraceHeaderExample statusCode="ERROR" annotationCount={1} />
      <TraceHeaderExample statusCode="UNSET" annotationCount={3} />
      <TraceHeaderExample statusCode="ERROR" annotationCount={12} />
    </DetailPanelExamples>
  ),
  tags: ["!dev"],
};

export const Metrics: Story = {
  args: {
    statusCode: "OK",
    latencyMs: 1842,
    costSummary: SANE_COST_SUMMARY,
  },
  render: () => (
    <DetailPanelExamples>
      {LATENCY_PERMUTATIONS.flatMap((latencyPermutation) =>
        COST_PERMUTATIONS.map((costPermutation) => (
          <TraceHeaderContent
            key={`${latencyPermutation.name}-${costPermutation.name}`}
            statusCode="OK"
            latencyMs={latencyPermutation.latencyMs}
            costSummary={costPermutation.costSummary}
            annotationSummaries={
              <AnnotationSummaries annotations={METRIC_ANNOTATIONS} />
            }
          />
        ))
      )}
    </DetailPanelExamples>
  ),
  tags: ["!dev"],
};

export const Miscellaneous: Story = {
  args: {
    statusCode: "ERROR",
    latencyMs: 31_536_000_000,
    costSummary: SANE_COST_SUMMARY,
  },
  render: () => (
    <DetailPanelExamples>
      <TraceHeaderContent
        statusCode="ERROR"
        latencyMs={31_536_000_000}
        costSummary={COST_PERMUTATIONS.at(-1)?.costSummary}
        annotationSummaries={getMiscellaneousAnnotationSummaries({
          rootSpanState: "with-annotations",
        })}
        trailingAction={sessionAction}
      />
      <TraceHeaderContent
        statusCode="UNSET"
        latencyMs={null}
        annotationSummaries={getMiscellaneousAnnotationSummaries({
          rootSpanState: "unavailable",
        })}
      />
      <TraceHeaderContent
        statusCode="OK"
        latencyMs={1842}
        costSummary={SANE_COST_SUMMARY}
        annotationSummaries={getMiscellaneousAnnotationSummaries({
          rootSpanState: "without-annotations",
        })}
      />
    </DetailPanelExamples>
  ),
  tags: ["!dev"],
};
