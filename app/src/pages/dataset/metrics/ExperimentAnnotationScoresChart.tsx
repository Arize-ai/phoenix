import type { TooltipContentProps } from "recharts";
import {
  CartesianGrid,
  Line,
  LineChart,
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

import { ExperimentMetricsTooltipHeader } from "./ExperimentMetricsTooltipHeader";
import {
  experimentMetricsYAxisProps,
  getExperimentXAxisProps,
} from "./experimentXAxisProps";
import type { ExperimentMetricViewProps } from "./types";
import { EXPERIMENT_METRICS_CHART_SYNC_ID } from "./types";
import { useExperimentMetricsData } from "./useExperimentMetricsData";

function TooltipContent({ active, payload, label }: TooltipContentProps) {
  const { theme } = useTheme();
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const datum = payload[0]?.payload as {
    experimentName?: string;
    isBaseline?: boolean;
  };
  const annotationEntries = payload.filter(
    (entry) => typeof entry.value === "number"
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
    </ChartTooltip>
  );
}

/**
 * Mean annotation scores, with one line per annotation, per experiment.
 */
export function ExperimentAnnotationScoresChart({
  datasetId,
}: ExperimentMetricViewProps) {
  const { theme } = useTheme();
  const { experiments, baselineExperiment } =
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
    scoreKeys.some(
      (scoreKey) =>
        typeof dataPoint[scoreKey as keyof typeof dataPoint] === "number"
    )
  );

  return (
    <ChartEmptyStateOverlay
      isEmpty={!hasData}
      message="No annotation data"
      chartType="line"
    >
      <ChartResponsiveContainer>
        <LineChart
          data={chartData}
          margin={compactChartMargin}
          syncId={EXPERIMENT_METRICS_CHART_SYNC_ID}
          syncMethod="value"
        >
          <CartesianGrid {...defaultCartesianGridProps} />
          <XAxis
            {...getExperimentXAxisProps(baselineExperiment?.sequenceNumber)}
          />
          <YAxis {...experimentMetricsYAxisProps} domain={yDomain} />
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
              animationDuration={COMPACT_CHART_ANIMATION_DURATION_MS}
            />
          ))}
          <InteractiveLegend
            {...compactLegendProps}
            hiddenDataKeys={hiddenDataKeys}
            iconSize={8}
            onToggleDataKey={toggleDataKey}
          />
          <Tooltip {...defaultTooltipProps} content={TooltipContent} />
        </LineChart>
      </ChartResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}
