import { useId } from "react";
import type { TooltipContentProps } from "recharts";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Text } from "@phoenix/components";
import {
  ChartEmptyStateOverlay,
  ChartResponsiveContainer,
  ChartTooltip,
  ChartTooltipDivider,
  ChartTooltipItem,
  compactChartMargin,
  compactLegendProps,
  compactTimeXAxisProps,
  compactYAxisProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
  InteractiveLegend,
  TimeRangeChartBrush,
  useGrayscaleCategoricalColors,
  useInteractiveLegend,
  useSemanticChartColors,
  useSequentialChartColors,
} from "@phoenix/components/chart";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import type {
  QueueSizeRow,
  QueueThroughputRow,
} from "@phoenix/pages/project/metrics/queueThroughput";
import { getMirroredCountAxis } from "@phoenix/pages/project/metrics/queueThroughput";
import {
  intFormatter,
  intShortFormatter,
} from "@phoenix/utils/numberFormatUtils";

/**
 * The queue charts of the Evaluators page and a project's Evaluators tab:
 * the same marks, colors and tooltips on both, fed each page's own rows.
 */

/** The top of an area's fill, fading to nothing at the baseline. */
const AREA_FILL_TOP_OPACITY = 0.3;

export type QueueChartTimeAxis = {
  domain: number[];
  tickFormatter: (x: number) => string;
};

type QueueChartProps<Row> = {
  rows: Row[];
  xAxis: QueueChartTimeAxis;
  /**
   * Narrows the page's time range to a clicked bin or dragged window. Omit
   * for a chart that only reads.
   */
  onTimeRangeSelected?: (timeRange: TimeRange) => void;
  /** The bins' scale, so a click narrows to the clicked bin. */
  scale?: TimeBinScale;
  /** Keeps hover in step with the other charts of the same strip. */
  syncId?: string;
};

export function TimeTooltipContent({
  active,
  payload,
  label,
  formatValue = intFormatter,
}: TooltipContentProps & { formatValue?: (value: number) => string }) {
  const { fullTimeFormatter } = useTimeFormatters();
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  return (
    <ChartTooltip>
      {label != null ? (
        <Text weight="heavy" size="S">
          {fullTimeFormatter(new Date(Number(label)))}
        </Text>
      ) : null}
      {payload.map((entry) =>
        entry.value == null ? null : (
          <ChartTooltipItem
            key={String(entry.dataKey)}
            color={entry.color ?? "transparent"}
            shape="circle"
            name={String(entry.name ?? entry.dataKey)}
            value={formatValue(Number(entry.value))}
          />
        )
      )}
    </ChartTooltip>
  );
}

/** A throughput row with completed negated, so its bar hangs below the line. */
type QueueThroughputChartRow = QueueThroughputRow & { completedBelow: number };

function formatSignedCount(value: number): string {
  return value > 0 ? `+${intFormatter(value)}` : intFormatter(value);
}

function QueueThroughputTooltipContent({
  active,
  payload,
  label,
  addedColor,
  completedColor,
  queueSizeColor,
}: TooltipContentProps & {
  addedColor: string;
  completedColor: string;
  queueSizeColor: string;
}) {
  const { fullTimeFormatter } = useTimeFormatters();
  const semanticColors = useSemanticChartColors();
  const grayscaleColors = useGrayscaleCategoricalColors();
  const row = payload?.[0]?.payload as QueueThroughputChartRow | undefined;
  if (!active || row == null) {
    return null;
  }
  const net = row.added - row.completed;
  const netItem =
    net > 0
      ? { name: "Falling behind", color: semanticColors.danger }
      : net < 0
        ? { name: "Catching up", color: semanticColors.success }
        : { name: "Keeping pace", color: grayscaleColors.gray3 };
  return (
    <ChartTooltip>
      {label != null ? (
        <Text weight="heavy" size="S">
          {fullTimeFormatter(new Date(Number(label)))}
        </Text>
      ) : null}
      <ChartTooltipItem
        color={addedColor}
        shape="square"
        name="Added"
        value={intFormatter(row.added)}
      />
      <ChartTooltipItem
        color={completedColor}
        shape="square"
        name="Completed"
        value={intFormatter(row.completed)}
      />
      <ChartTooltipDivider />
      <ChartTooltipItem
        color={netItem.color}
        shape="square"
        name={netItem.name}
        value={formatSignedCount(net)}
      />
      <ChartTooltipItem
        color={queueSizeColor}
        shape="line"
        name="Queue size"
        value={intFormatter(row.queueSize)}
      />
    </ChartTooltip>
  );
}

/**
 * Added and completed evaluations mirrored around the line: added above,
 * completed below, so a bin where the queue fell behind has the taller bar
 * on top.
 */
export function QueueThroughputChart({
  rows,
  xAxis,
  onTimeRangeSelected,
  scale,
  syncId,
}: QueueChartProps<QueueThroughputRow>) {
  const grayscaleColors = useGrayscaleCategoricalColors();
  const sequentialColors = useSequentialChartColors();
  const addedColor = grayscaleColors.gray1;
  const completedColor = grayscaleColors.gray3;
  const chartRows: QueueThroughputChartRow[] = rows.map((row) => ({
    ...row,
    completedBelow: -row.completed,
  }));
  const hasData = rows.some((row) => row.added > 0 || row.completed > 0);
  const { extent, ticks } = getMirroredCountAxis(
    Math.max(0, ...rows.map((row) => Math.max(row.added, row.completed)))
  );
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  return (
    <TimeRangeChartBrush
      onTimeRangeSelected={onTimeRangeSelected}
      scale={scale}
    >
      {({ chartProps }) => (
        <ChartEmptyStateOverlay
          isEmpty={!hasData}
          message="No evaluations in this time range"
          chartType="bar"
        >
          <ChartResponsiveContainer>
            <BarChart
              data={chartRows}
              margin={compactChartMargin}
              maxBarSize={8}
              stackOffset="sign"
              syncId={syncId}
              {...chartProps}
            >
              <CartesianGrid {...defaultCartesianGridProps} />
              <XAxis {...compactTimeXAxisProps} {...xAxis} />
              <YAxis
                {...compactYAxisProps}
                domain={[-extent, extent]}
                ticks={ticks}
                tickFormatter={(y: number) => intShortFormatter(Math.abs(y))}
              />
              <Tooltip
                content={(props: TooltipContentProps) => (
                  <QueueThroughputTooltipContent
                    {...props}
                    addedColor={addedColor}
                    completedColor={completedColor}
                    queueSizeColor={sequentialColors.blue500}
                  />
                )}
                {...defaultTooltipProps}
              />
              <ReferenceLine y={0} stroke="var(--chart-axis-stroke-color)" />
              <Bar
                dataKey="added"
                name="Added, above the line"
                stackId="throughput"
                fill={addedColor}
                hide={isDataKeyHidden("added")}
                isAnimationActive={false}
              />
              <Bar
                dataKey="completedBelow"
                name="Completed, below the line"
                stackId="throughput"
                fill={completedColor}
                hide={isDataKeyHidden("completedBelow")}
                isAnimationActive={false}
              />
              <InteractiveLegend
                {...compactLegendProps}
                hiddenDataKeys={hiddenDataKeys}
                iconType="square"
                iconSize={8}
                itemSorter={null}
                onToggleDataKey={toggleDataKey}
              />
            </BarChart>
          </ChartResponsiveContainer>
        </ChartEmptyStateOverlay>
      )}
    </TimeRangeChartBrush>
  );
}

/**
 * The evaluations in queue at each bin's end, as a filled line, with how
 * many evaluations were processed in each bin.
 */
export function QueueSizeChart({
  rows,
  xAxis,
  onTimeRangeSelected,
  scale,
  syncId,
}: QueueChartProps<QueueSizeRow>) {
  const sequentialColors = useSequentialChartColors();
  const grayscaleColors = useGrayscaleCategoricalColors();
  const queueSizeColor = sequentialColors.blue500;
  const processedColor = grayscaleColors.gray1;
  const gradientId = useId();
  const hasData = rows.some((row) => row.queueSize > 0 || row.processed > 0);
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  return (
    <TimeRangeChartBrush
      onTimeRangeSelected={onTimeRangeSelected}
      scale={scale}
    >
      {({ chartProps }) => (
        <ChartEmptyStateOverlay
          isEmpty={!hasData}
          message="Nothing in queue in this time range"
          chartType="line"
        >
          <ChartResponsiveContainer>
            <ComposedChart
              data={rows}
              margin={compactChartMargin}
              syncId={syncId}
              {...chartProps}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0"
                    stopColor={queueSizeColor}
                    stopOpacity={AREA_FILL_TOP_OPACITY}
                  />
                  <stop offset="1" stopColor={queueSizeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...defaultCartesianGridProps} />
              <XAxis {...compactTimeXAxisProps} {...xAxis} />
              <YAxis
                {...compactYAxisProps}
                tickFormatter={(y: number) => intShortFormatter(y)}
              />
              <Tooltip content={TimeTooltipContent} {...defaultTooltipProps} />
              <Area
                type="monotone"
                dataKey="queueSize"
                name="In queue"
                stroke={queueSizeColor}
                fill={`url(#${gradientId})`}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4 }}
                hide={isDataKeyHidden("queueSize")}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="processed"
                name="Processed"
                stroke={processedColor}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4 }}
                hide={isDataKeyHidden("processed")}
                isAnimationActive={false}
              />
              <InteractiveLegend
                {...compactLegendProps}
                hiddenDataKeys={hiddenDataKeys}
                iconType="circle"
                iconSize={8}
                itemSorter={null}
                onToggleDataKey={toggleDataKey}
              />
            </ComposedChart>
          </ChartResponsiveContainer>
        </ChartEmptyStateOverlay>
      )}
    </TimeRangeChartBrush>
  );
}
