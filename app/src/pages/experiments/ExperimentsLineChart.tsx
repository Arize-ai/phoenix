/**
 * A line chart of the experiments for a given dataset.
 * This in the future might be extended for more use cases.
 */
import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { format } from "d3-format";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";

import { Flex, Text } from "@phoenix/components";
import {
  ChartTooltip,
  ChartTooltipItem,
  useChartColors,
} from "@phoenix/components/chart";
import { SequenceNumberToken } from "@phoenix/components/experiment/SequenceNumberToken";
import { getWordColor } from "@phoenix/utils/colorUtils";

import type { ExperimentsLineChartQuery } from "./__generated__/ExperimentsLineChartQuery.graphql";

export type ExperimentsLineChartData = {
  iteration: number;
  avgLatency: number;
  [scoreKey: string]: number | string;
};

const chartMargins = { top: 8, right: 18, left: 18, bottom: 58 };

const numberFormatter = new Intl.NumberFormat([], {
  maximumFractionDigits: 4,
});

const latencyFormatter = (value: number | null | undefined) => {
  if (typeof value !== "number") return "--";
  return `${format(".1f")(value / 1000)}s`;
};

function TooltipContent({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  const { gray300 } = useChartColors();
  // Use the same color logic as the chart lines
  if (active && payload && payload.length) {
    // Filter out avgLatency and show all other annotation scores
    const annotationEntries = payload.filter(
      (p) => p.dataKey !== "avgLatency" && typeof p.value === "number"
    );
    // Sequence number is the x value (label)
    return (
      <ChartTooltip>
        <Flex direction="row" alignItems="center" gap="size-100">
          <Text weight="heavy" size="S">
            experiment
          </Text>
          <SequenceNumberToken sequenceNumber={Number(label)} />
        </Flex>
        {annotationEntries.map((entry) => (
          <ChartTooltipItem
            key={String(entry.dataKey)}
            color={getWordColor(String(entry.dataKey))}
            shape="line"
            name={String(entry.dataKey)}
            value={
              typeof entry.value === "number"
                ? numberFormatter.format(entry.value)
                : "--"
            }
          />
        ))}
        {/* Avg Latency */}
        {(() => {
          const entry = payload.find((p) => p.dataKey === "avgLatency");
          if (!entry) return null;
          return (
            <ChartTooltipItem
              key="avgLatency"
              color={gray300}
              shape="square"
              name="avg latency"
              value={latencyFormatter(entry.value as number)}
            />
          );
        })()}
      </ChartTooltip>
    );
  }
  return null;
}

export function ExperimentsLineChart({ datasetId }: { datasetId: string }) {
  const data = useLazyLoadQuery<ExperimentsLineChartQuery>(
    graphql`
      query ExperimentsLineChartQuery($id: ID!) {
        dataset: node(id: $id) {
          ... on Dataset {
            experiments(first: 50) {
              edges {
                experiment: node {
                  id
                  sequenceNumber
                  averageRunLatencyMs
                  annotationSummaries {
                    annotationName
                    meanScore
                  }
                }
              }
            }
          }
        }
      }
    `,
    { id: datasetId }
  );

  const { chartData, scoreKeys } = useMemo(() => {
    const allAnnotationNames = new Set<string>();
    const chartData = (data.dataset?.experiments?.edges ?? [])
      .map((edge) => {
        const exp = edge.experiment;
        const scores: Record<string, number | undefined> = {};
        const summaries = exp.annotationSummaries;
        for (const summary of summaries) {
          allAnnotationNames.add(summary.annotationName);
          scores[summary.annotationName] = summary.meanScore ?? undefined;
        }
        return {
          iteration: exp.sequenceNumber,
          avgLatency: exp.averageRunLatencyMs ?? undefined,
          ...scores,
        };
      })
      .filter((dataPoint) => dataPoint !== null)
      .sort((a, b) => a.iteration - b.iteration);
    return { chartData, scoreKeys: Array.from(allAnnotationNames) };
  }, [data.dataset?.experiments?.edges]);

  const { gray300 } = useChartColors();
  // Memoize colors for each annotation name (scoreKey) using the same logic as useWordColor
  const lineColors = useMemo(() => {
    const colorMap: Record<string, string> = {};
    for (const key of scoreKeys) {
      colorMap[key] = getWordColor(key);
    }
    return colorMap;
  }, [scoreKeys]);

  // Memoize yDomain calculation
  const yDomain = useMemo(() => {
    let minScore = Infinity;
    let maxScore = -Infinity;
    for (const dataPoint of chartData) {
      for (const scoreKey of scoreKeys) {
        const scoreValue = dataPoint[scoreKey as keyof typeof dataPoint];
        if (typeof scoreValue === "number") {
          if (scoreValue < minScore) minScore = scoreValue;
          if (scoreValue > maxScore) maxScore = scoreValue;
        }
      }
    }
    // If the min score is 0 and the max score is 1, return [0, 1] for consistency
    return minScore >= 0 && maxScore <= 1 ? [0, 1] : undefined;
  }, [chartData, scoreKeys]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={chartData}
        margin={chartMargins}
        syncId="dimensionDetails"
      >
        <defs>
          <linearGradient id="latencyBarColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={gray300} stopOpacity={0.3} />
            <stop offset="95%" stopColor={gray300} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="var(--ac-global-color-grey-500)"
          strokeOpacity={0.5}
        />
        <XAxis
          dataKey="iteration"
          tick={{ fontSize: 12, fill: "var(--ac-global-text-color-700)" }}
        />
        <YAxis
          stroke="var(--ac-global-color-grey-500)"
          label={{
            value: "Score",
            angle: -90,
            position: "insideLeft",
            style: {
              textAnchor: "middle",
              fill: "var(--ac-global-text-color-900)",
            },
          }}
          style={{ fill: "var(--ac-global-text-color-700)" }}
          domain={yDomain}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="var(--ac-global-color-grey-500)"
          label={{
            value: "avg latency",
            angle: 90,
            position: "insideRight",
            style: {
              textAnchor: "middle",
              fill: "var(--ac-global-text-color-900)",
            },
          }}
          style={{ fill: "var(--ac-global-text-color-700)" }}
          tickFormatter={latencyFormatter}
        />

        <Bar
          yAxisId="right"
          dataKey="avgLatency"
          fill="url(#latencyBarColor)"
          spacing={3}
        />
        {scoreKeys.map((key) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={lineColors[key]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            yAxisId={0}
          />
        ))}
        <Tooltip content={TooltipContent} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
