import type { Meta, StoryObj } from "@storybook/react";

import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation/optimizationUtils";
import { SummaryValueBreakdown } from "@phoenix/pages/project/AnnotationSummary";

import { OptionGrid } from "../../utils/OptionGrid";

type BreakdownProps = Parameters<typeof SummaryValueBreakdown>[0];

const correctness: AnnotationOptimizationConfig = {
  annotationType: "CONTINUOUS",
  optimizationDirection: "MAXIMIZE",
  lowerBound: 0,
  upperBound: 1,
};

const toxicity: AnnotationOptimizationConfig = {
  annotationType: "CONTINUOUS",
  optimizationDirection: "MINIMIZE",
  lowerBound: 0,
  upperBound: 1,
};

const relevance: AnnotationOptimizationConfig = {
  annotationType: "FREEFORM",
  optimizationDirection: "MAXIMIZE",
  threshold: 0.5,
};

const qaCorrectness: AnnotationOptimizationConfig = {
  annotationType: "CATEGORICAL",
  optimizationDirection: "MAXIMIZE",
  values: [
    { label: "correct", score: 1 },
    { label: "incorrect", score: 0 },
  ],
};

const tone: AnnotationOptimizationConfig = {
  annotationType: "CATEGORICAL",
  optimizationDirection: "NONE",
  values: [
    { label: "neutral", score: null },
    { label: "friendly", score: null },
    { label: "formal", score: null },
    { label: "curt", score: null },
    { label: "apologetic", score: null },
  ],
};

type BreakdownCase = { label: string; props: BreakdownProps };

const MEAN_SCORE_COLORS: readonly BreakdownCase[] = [
  {
    label: "Maximize, 0 to 1 · 0.62",
    props: {
      annotationName: "correctness",
      meanScore: 0.62,
      annotationConfig: correctness,
    },
  },
  {
    label: "Maximize, 0 to 1 · 0.31",
    props: {
      annotationName: "correctness",
      meanScore: 0.31,
      annotationConfig: correctness,
    },
  },
  {
    label: "Maximize, 0 to 1 · 0.5",
    props: {
      annotationName: "correctness",
      meanScore: 0.5,
      annotationConfig: correctness,
    },
  },
  {
    label: "Minimize, 0 to 1 · 0.31",
    props: {
      annotationName: "toxicity",
      meanScore: 0.31,
      annotationConfig: toxicity,
    },
  },
  {
    label: "Threshold 0.5 · 0.62",
    props: {
      annotationName: "relevance",
      meanScore: 0.62,
      annotationConfig: relevance,
    },
  },
  {
    label: "Threshold 0.5 · 0.31",
    props: {
      annotationName: "relevance",
      meanScore: 0.31,
      annotationConfig: relevance,
    },
  },
  {
    label: "Categorical · 0.62",
    props: {
      annotationName: "qa_correctness",
      meanScore: 0.62,
      labelFractions: [
        { label: "correct", fraction: 0.62 },
        { label: "incorrect", fraction: 0.38 },
      ],
      annotationConfig: qaCorrectness,
    },
  },
  {
    label: "Maximize, 0 to 1 · 1.3",
    props: {
      annotationName: "correctness",
      meanScore: 1.3,
      annotationConfig: correctness,
    },
  },
  {
    label: "No config · 0.62",
    props: { annotationName: "correctness", meanScore: 0.62 },
  },
];

const CONTENT_TYPES: readonly BreakdownCase[] = [
  {
    label: "Labels",
    props: {
      annotationName: "tone",
      labelFractions: [
        { label: "neutral", fraction: 0.46 },
        { label: "friendly", fraction: 0.31 },
        { label: "formal", fraction: 0.12 },
        { label: "curt", fraction: 0.08 },
        { label: "apologetic", fraction: 0.03 },
      ],
      annotationConfig: tone,
    },
  },
  {
    label: "Score",
    props: {
      annotationName: "correctness",
      meanScore: 0.62,
      annotationConfig: correctness,
    },
  },
  {
    label: "Labels and score",
    props: {
      annotationName: "qa_correctness",
      meanScore: 0.62,
      labelFractions: [
        { label: "correct", fraction: 0.62 },
        { label: "incorrect", fraction: 0.38 },
      ],
      annotationConfig: qaCorrectness,
    },
  },
  {
    label: "Partly scored",
    props: {
      annotationName: "correctness",
      meanScore: 0.62,
      annotationConfig: correctness,
      count: 24,
      scoreCount: 18,
      labelCount: 0,
    },
  },
  {
    label: "Partly scored and labeled",
    props: {
      annotationName: "qa_correctness",
      meanScore: 0.62,
      labelFractions: [
        { label: "correct", fraction: 0.62 },
        { label: "incorrect", fraction: 0.38 },
      ],
      annotationConfig: qaCorrectness,
      count: 24,
      scoreCount: 21,
      labelCount: 21,
    },
  },
];

/**
 * The breakdown an annotation summary opens on hover in a project's traces
 * and spans headers and in the spans table aside: each label's share, the
 * mean score, and how many of the annotated rows carry a score or label when
 * some do not.
 *
 * The mean score is colored from the annotation's config, as `Annotation
 * Score Text` describes. With no config, or no optimization direction, it is
 * uncolored.
 */
const meta: Meta<typeof SummaryValueBreakdown> = {
  title: "Domains/Annotations/Summary Value Breakdown",
  tags: ["updated", "complete", "unreviewed"],
  component: SummaryValueBreakdown,
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof SummaryValueBreakdown>;

export const Default: Story = {
  tags: ["!dev"],
  render: () => <SummaryValueBreakdown {...MEAN_SCORE_COLORS[0].props} />,
};

export const MeanScoreColors: Story = {
  name: "Mean Score Colors",
  tags: ["!dev"],
  parameters: { themeLayout: "row" },
  render: () => (
    <OptionGrid
      rows={MEAN_SCORE_COLORS}
      renderCell={(row) => <SummaryValueBreakdown {...row.props} />}
    />
  ),
};

export const ContentTypes: Story = {
  name: "Content Types",
  tags: ["!dev"],
  parameters: { themeLayout: "row" },
  render: () => (
    <OptionGrid
      rows={CONTENT_TYPES}
      alignRows="start"
      renderCell={(row) => <SummaryValueBreakdown {...row.props} />}
    />
  ),
};
