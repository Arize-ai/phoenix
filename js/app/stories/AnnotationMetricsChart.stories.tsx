import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Text } from "@phoenix/components";
import {
  AnnotationMetricsChart,
  type AnnotationMetricsChartPoint,
  type AnnotationMetricsInputPoint,
  type AnnotationMetricsSeries,
  AnnotationMetricsViewMenu,
  type AnnotationMetricsView,
  ChartPanel,
  compactCategoryXAxisProps,
  compactYAxisProps,
  getDefaultAnnotationMetricsView,
  normalizeAnnotationMetrics,
} from "@phoenix/components/chart";

const ANNOTATION_NAME = "response quality";
const LONG_ANNOTATION_NAME =
  "policy_compliance_groundedness_citation_completeness_escalation_decision_and_response_quality";
const LONG_LABEL_NAME =
  "passes all production quality gates with complete citations and no unsupported claims";
const LONG_UNBROKEN_LABEL_NAME =
  "needs_human_review_due_to_policy_ambiguity_and_insufficient_source_attribution";

type LabelFraction = {
  label: string;
  fraction: number;
};

/**
 * Creates one normalized-series input point for a single annotation.
 * @param params - Story fixture values.
 * @param params.x - Category shown on the x axis.
 * @param params.annotationName - Annotation represented by the point.
 * @param params.meanScore - Optional numeric annotation score.
 * @param params.labelFractions - Optional categorical distribution.
 */
function createAnnotationMetricsPoint({
  x,
  annotationName = ANNOTATION_NAME,
  meanScore = null,
  labelFractions = [],
}: {
  x: number;
  annotationName?: string;
  meanScore?: number | null;
  labelFractions?: ReadonlyArray<LabelFraction>;
}): AnnotationMetricsInputPoint {
  return {
    x,
    metadata: { runName: `Run ${x}` },
    summaries: [
      {
        name: annotationName,
        meanScore,
        labelFractions,
      },
    ],
  };
}

/**
 * Normalizes story inputs and requires the expected single annotation series.
 * @param params - Story fixture values.
 * @param params.points - Visible chart points.
 * @param params.referencePoint - Optional comparison point.
 */
function createAnnotationMetricsSeries({
  points,
  referencePoint,
}: {
  points: ReadonlyArray<AnnotationMetricsInputPoint>;
  referencePoint?: AnnotationMetricsInputPoint;
}): AnnotationMetricsSeries {
  const [series] = normalizeAnnotationMetrics({ points, referencePoint });
  if (series == null) {
    throw new Error(
      "The annotation metrics story fixture must create a series"
    );
  }
  return series;
}

const labelDistributionSeries = createAnnotationMetricsSeries({
  points: [
    createAnnotationMetricsPoint({
      x: 1,
      labelFractions: [
        { label: "approved", fraction: 0.65 },
        { label: "needs review", fraction: 0.25 },
      ],
    }),
    createAnnotationMetricsPoint({
      x: 2,
      labelFractions: [
        { label: "approved", fraction: 0.55 },
        { label: "needs review", fraction: 0.3 },
        { label: "rejected", fraction: 0.15 },
      ],
    }),
    createAnnotationMetricsPoint({
      x: 3,
      labelFractions: [
        { label: "approved", fraction: 0.72 },
        { label: "needs review", fraction: 0.18 },
        { label: "rejected", fraction: 0.1 },
      ],
    }),
    createAnnotationMetricsPoint({
      x: 4,
      labelFractions: [
        { label: "approved", fraction: 0.8 },
        { label: "needs review", fraction: 0.12 },
        { label: "rejected", fraction: 0.08 },
      ],
    }),
  ],
});

const scoreSeries = createAnnotationMetricsSeries({
  points: [
    createAnnotationMetricsPoint({ x: 1, meanScore: 0.62 }),
    createAnnotationMetricsPoint({ x: 2, meanScore: 0.71 }),
    createAnnotationMetricsPoint({ x: 3, meanScore: 0.78 }),
    createAnnotationMetricsPoint({ x: 4, meanScore: 0.86 }),
  ],
});

const mixedSeries = createAnnotationMetricsSeries({
  points: [
    createAnnotationMetricsPoint({
      x: 1,
      meanScore: 0.58,
      labelFractions: [
        { label: "pass", fraction: 0.55 },
        { label: "fail", fraction: 0.45 },
      ],
    }),
    createAnnotationMetricsPoint({
      x: 2,
      meanScore: 0.7,
      labelFractions: [
        { label: "pass", fraction: 0.68 },
        { label: "fail", fraction: 0.32 },
      ],
    }),
    createAnnotationMetricsPoint({
      x: 3,
      meanScore: 0.82,
      labelFractions: [
        { label: "pass", fraction: 0.8 },
        { label: "fail", fraction: 0.2 },
      ],
    }),
    createAnnotationMetricsPoint({
      x: 4,
      meanScore: 0.9,
      labelFractions: [
        { label: "pass", fraction: 0.88 },
        { label: "fail", fraction: 0.12 },
      ],
    }),
  ],
});

const longNamesSeries = createAnnotationMetricsSeries({
  points: [
    createAnnotationMetricsPoint({
      x: 1,
      annotationName: LONG_ANNOTATION_NAME,
      labelFractions: [
        { label: LONG_LABEL_NAME, fraction: 0.6 },
        { label: LONG_UNBROKEN_LABEL_NAME, fraction: 0.4 },
      ],
    }),
    createAnnotationMetricsPoint({
      x: 2,
      annotationName: LONG_ANNOTATION_NAME,
      labelFractions: [
        { label: LONG_LABEL_NAME, fraction: 0.72 },
        { label: LONG_UNBROKEN_LABEL_NAME, fraction: 0.28 },
      ],
    }),
    createAnnotationMetricsPoint({
      x: 3,
      annotationName: LONG_ANNOTATION_NAME,
      labelFractions: [
        { label: LONG_LABEL_NAME, fraction: 0.8 },
        { label: LONG_UNBROKEN_LABEL_NAME, fraction: 0.2 },
      ],
    }),
  ],
});

const emptySeries: AnnotationMetricsSeries = {
  name: ANNOTATION_NAME,
  views: ["labels"],
  labels: [],
  data: [],
};

type AnnotationMetricsChartStoryProps = {
  series: AnnotationMetricsSeries;
  initialView?: AnnotationMetricsView;
  width?: number;
};

function AnnotationMetricsChartStory({
  series,
  initialView,
  width = 720,
}: AnnotationMetricsChartStoryProps) {
  const [view, setView] = useState(
    () => initialView ?? getDefaultAnnotationMetricsView(series)
  );
  const activeView = series.views.includes(view)
    ? view
    : getDefaultAnnotationMetricsView(series);
  const showViewToggle = series.views.length > 1;

  return (
    <div style={{ width }}>
      <ChartPanel
        title={series.name}
        subtitle="Evaluation results across recent runs"
        actions={
          showViewToggle ? (
            <AnnotationMetricsViewMenu view={activeView} onChange={setView} />
          ) : undefined
        }
      >
        <AnnotationMetricsChart
          series={series}
          view={activeView}
          xAxisProps={{
            ...compactCategoryXAxisProps,
            dataKey: "x",
            interval: 0,
            tickFormatter: (value) => `#${String(value)}`,
          }}
          yAxisProps={compactYAxisProps}
          syncId="annotation-metrics-story"
          renderTooltipHeader={(point: AnnotationMetricsChartPoint) => (
            <Text weight="heavy" size="S">
              {String(point.metadata.runName ?? `Run ${point.x}`)}
            </Text>
          )}
        />
      </ChartPanel>
    </div>
  );
}

const meta: Meta<typeof AnnotationMetricsChartStory> = {
  title: "Charting/Annotation Metrics Chart",
  component: AnnotationMetricsChartStory,
  parameters: {
    layout: "padded",
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof AnnotationMetricsChartStory>;

/**
 * Categorical results render as a normalized stacked distribution. Run 1 also
 * leaves a residual share so the generated "other" legend item is visible.
 */
export const LabelDistribution: Story = {
  args: {
    series: labelDistributionSeries,
  },
};

/**
 * Numeric-only annotations render as a line with the score domain and
 * score-specific tooltip formatting.
 */
export const Scores: Story = {
  args: {
    series: scoreSeries,
  },
};

/**
 * Mixed annotations expose the production labels/scores view toggle.
 */
export const ScoresAndLabels: Story = {
  args: {
    series: mixedSeries,
    initialView: "labels",
  },
};

/**
 * An empty series keeps the chart panel context while showing the shared
 * annotation-metrics empty state.
 */
export const Empty: Story = {
  args: {
    series: emptySeries,
  },
};

/**
 * A narrow panel exercises long annotation titles and both wrapping and
 * unbroken categorical legend labels.
 */
export const LongNames: Story = {
  args: {
    series: longNamesSeries,
    width: 360,
  },
};
