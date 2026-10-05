import type { TooltipContentProps } from "recharts";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartEmptyStateOverlay,
  ChartResponsiveContainer,
  ChartTooltip,
  ChartTooltipItem,
  COMPACT_CHART_ANIMATION_DURATION_MS,
  compactChartMargin,
  compactLegendProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
  InteractiveLegend,
  useInteractiveLegend,
} from "@phoenix/components/chart";
import { useTheme } from "@phoenix/contexts";
import { getWordColor } from "@phoenix/utils/colorUtils";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { useExperimentChartDatum } from "./experimentMetricsSelection";
import type { ExperimentMetricsTooltipDatum } from "./ExperimentMetricsTooltipContent";
import { ExperimentMetricsTooltipHeader } from "./ExperimentMetricsTooltipHeader";
import {
  experimentMetricsYAxisProps,
  getExperimentXAxisProps,
} from "./experimentXAxisProps";
import type { ExperimentMetricViewProps } from "./types";
import { EXPERIMENT_METRICS_CHART_SYNC_ID } from "./types";
import { useExperimentMetricsData } from "./useExperimentMetricsData";

function TooltipContent({
  active,
  payload,
  label,
  shape,
}: TooltipContentProps & { shape: "line" | "square" }) {
  const { theme } = useTheme();
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const datum = payload[0]?.payload as ExperimentMetricsTooltipDatum;
  const annotationEntries = payload.filter(
    (entry) => typeof entry.value === "number"
  );
  return (
    <ChartTooltip>
      <ExperimentMetricsTooltipHeader
        sequenceNumber={Number(label)}
        name={datum?.experimentName}
        isBaseline={datum?.isBaseline}
        color={datum?.experimentColor}
        referenceLabel={datum?.referenceLabel}
      />
      {annotationEntries.map((entry) => (
        <ChartTooltipItem
          key={String(entry.dataKey)}
          color={getWordColor({ word: String(entry.dataKey), theme })}
          shape={shape}
          name={String(entry.dataKey)}
          value={
            typeof entry.value === "number" ? formatFloat(entry.value) : "--"
          }
        />
      ))}
    </ChartTooltip>
  );
}

/**
 * Mean annotation scores, with one line per annotation, per experiment.
 */
export function ExperimentAnnotationScoresChart({
  datasetId,
  selection,
}: ExperimentMetricViewProps) {
  const { theme } = useTheme();
  const { experiments, baselineExperiment } = useExperimentMetricsData({
    datasetId,
    selection,
  });
  const { toExperimentChartDatum } = useExperimentChartDatum(selection);
  const isSelection = selection != null;

  const scoreKeySet = new Set<string>();
  const chartData = experiments.map((experiment) => {
    const scores: Record<string, number | undefined> = {};
    for (const summary of experiment.annotationSummaries) {
      scoreKeySet.add(summary.annotationName);
      scores[summary.annotationName] = summary.meanScore ?? undefined;
    }
    return {
      ...scores,
      ...toExperimentChartDatum(experiment),
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
    scoreKeys.some(
      (scoreKey) =>
        typeof dataPoint[scoreKey as keyof typeof dataPoint] === "number"
    )
  );

  return (
    <ChartEmptyStateOverlay
      isEmpty={!hasData}
      message="No annotation data"
      chartType={isSelection ? "bar" : "line"}
    >
      <ChartResponsiveContainer>
        <ComposedChart
          data={chartData}
          barSize={isSelection ? 6 : undefined}
          margin={compactChartMargin}
          syncId={EXPERIMENT_METRICS_CHART_SYNC_ID}
          syncMethod="value"
        >
          <CartesianGrid {...defaultCartesianGridProps} />
          <XAxis
            {...getExperimentXAxisProps({
              baselineSequenceNumber: baselineExperiment?.sequenceNumber,
              experiments: chartData,
            })}
          />
          <YAxis {...experimentMetricsYAxisProps} domain={yDomain} />
          {scoreKeys.map((key) => {
            const color = getWordColor({ word: key, theme });
            const markProps = {
              dataKey: key,
              hide: isDataKeyHidden(key),
              yAxisId: 0,
              animationDuration: COMPACT_CHART_ANIMATION_DURATION_MS,
            };
            // Compared experiments have no inherent order, so a line between
            // them would imply a trend
            return isSelection ? (
              <Bar
                key={key}
                {...markProps}
                fill={color}
                radius={[2, 2, 0, 0]}
              />
            ) : (
              <Line
                key={key}
                {...markProps}
                type="monotone"
                stroke={color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            );
          })}
          <InteractiveLegend
            {...compactLegendProps}
            hiddenDataKeys={hiddenDataKeys}
            iconSize={8}
            onToggleDataKey={toggleDataKey}
          />
          <Tooltip
            {...defaultTooltipProps}
            content={(props) => (
              <TooltipContent
                {...props}
                shape={isSelection ? "square" : "line"}
              />
            )}
          />
        </ComposedChart>
      </ChartResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}
