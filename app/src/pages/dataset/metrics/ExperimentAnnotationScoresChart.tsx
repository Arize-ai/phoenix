import type { TooltipContentProps } from "recharts";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartEmptyStateOverlay,
  ChartTooltip,
  ChartTooltipItem,
  compactChartMargin,
  compactLegendProps,
  compactYAxisProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
  InteractiveLegend,
  useInteractiveLegend,
  useSequentialChartColors,
} from "@phoenix/components/chart";
import { useTheme } from "@phoenix/contexts";
import { getWordColor } from "@phoenix/utils/colorUtils";
import {
  formatFloat,
  latencyMsFormatter,
} from "@phoenix/utils/numberFormatUtils";

import {
  ExperimentBaselineSeparator,
  ExperimentBaselineValueLine,
} from "./ExperimentBaselineReference";
import {
  getExperimentXAxisProps,
  useExperimentMetricsData,
} from "./ExperimentMetrics";
import { ExperimentMetricsTooltipHeader } from "./ExperimentMetricsTooltipHeader";
import type { ExperimentMetricViewProps } from "./types";
import { EXPERIMENT_METRICS_CHART_SYNC_ID } from "./types";

const AVG_LATENCY_DATA_KEY = "avgLatency";

/**
 * Animation duration (ms) for the chart's marks. Recharts' default line
 * draw-in is 1500ms and replays on every re-render (including each resize
 * re-measure), which reads as a slow, janky animation while the panel is
 * dragged. Keep it short — matching the bars' 400ms default — so the chart
 * settles quickly.
 */
const CHART_ANIMATION_DURATION_MS = 400;

function TooltipContent({ active, payload, label }: TooltipContentProps) {
  const { gray300 } = useSequentialChartColors();
  const { theme } = useTheme();
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const datum = payload[0]?.payload as {
    experimentName?: string;
    isBaseline?: boolean;
  };
  const annotationEntries = payload.filter(
    (entry) =>
      entry.dataKey !== AVG_LATENCY_DATA_KEY && typeof entry.value === "number"
  );
  const latencyEntry = payload.find(
    (entry) => entry.dataKey === AVG_LATENCY_DATA_KEY
  );
  return (
    <ChartTooltip>
      <ExperimentMetricsTooltipHeader
        sequenceNumber={Number(label)}
        name={datum?.experimentName}
        isBaseline={datum?.isBaseline}
      />
      {annotationEntries.map((entry) => (
        <ChartTooltipItem
          key={String(entry.dataKey)}
          color={getWordColor({ word: String(entry.dataKey), theme })}
          shape="line"
          name={String(entry.dataKey)}
          value={
            typeof entry.value === "number" ? formatFloat(entry.value) : "--"
          }
        />
      ))}
      {latencyEntry && (
        <ChartTooltipItem
          color={gray300}
          shape="square"
          name="avg latency"
          value={latencyMsFormatter(
            typeof latencyEntry.value === "number" ? latencyEntry.value : null
          )}
        />
      )}
    </ChartTooltip>
  );
}

/**
 * Mean annotation scores (one line per annotation) and average run latency
 * (bars, right axis) per experiment.
 */
export function ExperimentAnnotationScoresChart({
  datasetId,
}: ExperimentMetricViewProps) {
  const { theme } = useTheme();
  const { experiments, baselineExperiment, isBaselineOutOfWindow } =
    useExperimentMetricsData(datasetId);

  const scoreKeySet = new Set<string>();
  const chartData = experiments.map((experiment) => {
    const scores: Record<string, number | undefined> = {};
    for (const summary of experiment.annotationSummaries) {
      scoreKeySet.add(summary.annotationName);
      scores[summary.annotationName] = summary.meanScore ?? undefined;
    }
    return {
      sequenceNumber: experiment.sequenceNumber,
      experimentName: experiment.name,
      isBaseline: experiment.isBaseline,
      [AVG_LATENCY_DATA_KEY]: experiment.averageRunLatencyMs ?? undefined,
      ...scores,
    };
  });
  const scoreKeys = Array.from(scoreKeySet);

  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();

  // Snap the score axis to [0, 1] when every visible score fits in it, so
  // normalized scores read consistently across experiments
  const visibleScoreKeys = scoreKeys.filter(
    (scoreKey) => !hiddenDataKeys.has(scoreKey)
  );
  let minScore = Infinity;
  let maxScore = -Infinity;
  for (const dataPoint of chartData) {
    for (const scoreKey of visibleScoreKeys) {
      const scoreValue = dataPoint[scoreKey as keyof typeof dataPoint];
      if (typeof scoreValue === "number") {
        if (scoreValue < minScore) minScore = scoreValue;
        if (scoreValue > maxScore) maxScore = scoreValue;
      }
    }
  }
  const yDomain =
    minScore >= 0 && maxScore <= 1 && maxScore !== -Infinity
      ? ([0, 1] as [number, number])
      : undefined;

  const hasData = chartData.some((dataPoint) =>
    Object.entries(dataPoint).some(
      ([key, value]) =>
        key !== "sequenceNumber" &&
        key !== "experimentName" &&
        typeof value === "number"
    )
  );

  const { gray300 } = useSequentialChartColors();
  return (
    <ChartEmptyStateOverlay
      isEmpty={!hasData}
      message="No annotation or latency data"
      chartType="line"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={compactChartMargin}
          syncId={EXPERIMENT_METRICS_CHART_SYNC_ID}
        >
          <defs>
            <linearGradient id="latencyBarColor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={gray300} stopOpacity={0.3} />
              <stop offset="95%" stopColor={gray300} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...defaultCartesianGridProps} />
          <XAxis
            {...getExperimentXAxisProps(baselineExperiment?.sequenceNumber)}
          />
          <YAxis {...compactYAxisProps} domain={yDomain} />
          <YAxis
            {...compactYAxisProps}
            yAxisId="right"
            orientation="right"
            tickFormatter={(x) => latencyMsFormatter(x)}
          />
          {baselineExperiment?.annotationSummaries.map(
            ({ annotationName, meanScore }) =>
              typeof meanScore === "number" &&
              !isDataKeyHidden(annotationName) ? (
                <ExperimentBaselineValueLine
                  key={`baseline-${annotationName}`}
                  value={meanScore}
                  stroke={getWordColor({ word: annotationName, theme })}
                  yAxisId={0}
                />
              ) : null
          )}
          {isBaselineOutOfWindow && baselineExperiment && (
            <ExperimentBaselineSeparator
              sequenceNumber={baselineExperiment.sequenceNumber}
            />
          )}
          <Bar
            yAxisId="right"
            dataKey={AVG_LATENCY_DATA_KEY}
            fill="url(#latencyBarColor)"
            hide={isDataKeyHidden(AVG_LATENCY_DATA_KEY)}
            name="avg latency"
            animationDuration={CHART_ANIMATION_DURATION_MS}
          />
          {scoreKeys.map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={getWordColor({ word: key, theme })}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              hide={isDataKeyHidden(key)}
              yAxisId={0}
              animationDuration={CHART_ANIMATION_DURATION_MS}
            />
          ))}
          <InteractiveLegend
            {...compactLegendProps}
            hiddenDataKeys={hiddenDataKeys}
            iconSize={8}
            onToggleDataKey={toggleDataKey}
          />
          <Tooltip {...defaultTooltipProps} content={TooltipContent} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}
