import type { Meta, StoryObj } from "@storybook/react";

import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation";
import { ChartPanel } from "@phoenix/components/chart";
import {
  AnnotationScoreTimeSeriesChart,
  type AnnotationScoreTimeSeriesDatum,
} from "@phoenix/pages/project/metrics/AnnotationScoreTimeSeriesChart";
import { getProjectMetricChart } from "@phoenix/pages/project/metrics/chartCatalog";

const HOUR_MS = 60 * 60 * 1000;
const RANGE_START = Date.UTC(2026, 8, 1, 9);

type AnnotationScores = Readonly<Record<string, ReadonlyArray<number>>>;

function createTimeSeries(scoresByName: AnnotationScores) {
  const names = Object.keys(scoresByName);
  const bucketCount = Math.max(
    0,
    ...Object.values(scoresByName).map((scores) => scores.length)
  );
  const data: AnnotationScoreTimeSeriesDatum[] = Array.from(
    { length: bucketCount },
    (_, index) => ({
      timestamp: new Date(RANGE_START + index * HOUR_MS).toISOString(),
      scoresWithLabels: names.flatMap((label) => {
        const score = scoresByName[label]?.[index];
        return score == null ? [] : [{ label, score }];
      }),
    })
  );
  const timeRange: TimeRange = {
    start: new Date(RANGE_START),
    end: new Date(RANGE_START + Math.max(bucketCount - 1, 1) * HOUR_MS),
  };
  return { data, names, timeRange };
}

const correctnessConfig: AnnotationOptimizationConfig = {
  annotationType: "CONTINUOUS",
  optimizationDirection: "MAXIMIZE",
  lowerBound: 0,
  upperBound: 1,
};

const hallucinationConfig: AnnotationOptimizationConfig = {
  annotationType: "CONTINUOUS",
  optimizationDirection: "MINIMIZE",
  lowerBound: 0,
  upperBound: 1,
};

const toolCallAccuracyConfig: AnnotationOptimizationConfig = {
  annotationType: "FREEFORM",
  optimizationDirection: "MAXIMIZE",
  threshold: 0.5,
};

const annotationConfigsByName: ReadonlyMap<
  string,
  AnnotationOptimizationConfig
> = new Map([
  ["correctness", correctnessConfig],
  ["hallucination", hallucinationConfig],
  ["tool_call_accuracy", toolCallAccuracyConfig],
  ["relevance", correctnessConfig],
]);

type AnnotationScoreTimeSeriesChartStoryProps = {
  scoresByName: AnnotationScores;
};

function AnnotationScoreTimeSeriesChartStory({
  scoresByName,
}: AnnotationScoreTimeSeriesChartStoryProps) {
  const { name, description } = getProjectMetricChart("span_annotations");
  const { data, names, timeRange } = createTimeSeries(scoresByName);
  return (
    <div style={{ width: 720 }}>
      <ChartPanel title={name} subtitle={description}>
        <AnnotationScoreTimeSeriesChart
          data={data}
          names={names}
          scale="HOUR"
          timeRange={timeRange}
          annotationConfigsByName={annotationConfigsByName}
        />
      </ChartPanel>
    </div>
  );
}

/**
 * The line chart of mean annotation scores per time bucket that a project's
 * metrics strip shows for span, trace and session annotations. Its tooltip
 * colors each mean by the annotation's config, and opens only on hover.
 */
const meta: Meta<typeof AnnotationScoreTimeSeriesChart> = {
  title: "Domains/Tracing/Annotation Score Time Series Chart",
  tags: ["updated", "incomplete", "unreviewed"],
  component: AnnotationScoreTimeSeriesChart,
  parameters: {
    layout: "padded",
    controls: { disable: true },
    themeLayout: "column",
  },
};

export default meta;
type Story = StoryObj<typeof AnnotationScoreTimeSeriesChartStory>;

export const Default: Story = {
  tags: ["!dev"],
  render: () => (
    <AnnotationScoreTimeSeriesChartStory
      scoresByName={{
        correctness: [0.72, 0.68, 0.75, 0.81, 0.78, 0.84, 0.8, 0.86],
        hallucination: [0.18, 0.22, 0.15, 0.12, 0.2, 0.09, 0.11, 0.07],
      }}
    />
  ),
};

/**
 * Hover a bucket to see each mean colored by its annotation's config.
 * `correctness` and `relevance` maximize between bounds of 0 and 1,
 * `hallucination` minimizes between the same bounds, `tool_call_accuracy`
 * maximizes against a threshold of 0.5 with no bounds, and `user_feedback`
 * has no config. The first bucket is below every pivot, the third is at it,
 * and the last is above it; the color strengthens with the distance from the
 * pivot toward the best or worst bound. A threshold with no bounds colors
 * every score on either side at full strength, the `relevance` means outside
 * its bounds are clamped to full strength, and `user_feedback` is not colored.
 */
export const ScoreColors: Story = {
  tags: ["!dev"],
  render: () => (
    <AnnotationScoreTimeSeriesChartStory
      scoresByName={{
        correctness: [0.1, 0.3, 0.5, 0.7, 0.9],
        hallucination: [0.9, 0.7, 0.5, 0.3, 0.1],
        tool_call_accuracy: [0.1, 0.3, 0.5, 0.7, 0.9],
        relevance: [-0.4, 0.3, 0.5, 0.7, 1.4],
        user_feedback: [0.2, 0.35, 0.5, 0.65, 0.8],
      }}
    />
  ),
};

export const Empty: Story = {
  tags: ["!dev"],
  render: () => <AnnotationScoreTimeSeriesChartStory scoresByName={{}} />,
};
