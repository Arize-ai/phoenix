import type { XAxisTickContentProps } from "recharts";
import { ReferenceLine } from "recharts";

export const BASELINE_COLOR = "var(--global-color-indigo-500)";

const BASELINE_STROKE_DASHARRAY = "4 4";
const BASELINE_SEPARATOR_STROKE_DASHARRAY = "3 3";

export function ExperimentBaselineValueLine({
  value,
  stroke = BASELINE_COLOR,
  yAxisId,
}: {
  value: number | null | undefined;
  stroke?: string;
  yAxisId?: string | number;
}) {
  if (typeof value !== "number") {
    return null;
  }
  return (
    <ReferenceLine
      y={value}
      yAxisId={yAxisId}
      stroke={stroke}
      strokeDasharray={BASELINE_STROKE_DASHARRAY}
      strokeWidth={1}
      ifOverflow="extendDomain"
    />
  );
}

export function ExperimentBaselineSeparator({
  sequenceNumber,
}: {
  sequenceNumber: number;
}) {
  return (
    <ReferenceLine
      x={sequenceNumber}
      position="end"
      stroke="var(--chart-axis-stroke-color)"
      strokeDasharray={BASELINE_SEPARATOR_STROKE_DASHARRAY}
    />
  );
}

export function makeExperimentAxisTick(baselineSequenceNumber?: number) {
  return function ExperimentAxisTick({
    x,
    y,
    payload,
    textAnchor,
  }: XAxisTickContentProps) {
    const isBaseline = payload.value === baselineSequenceNumber;
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          dy="0.71em"
          textAnchor={textAnchor}
          fontSize="12px"
          fontWeight={isBaseline ? 600 : undefined}
          fill={isBaseline ? BASELINE_COLOR : "var(--chart-axis-text-color)"}
        >
          {`#${payload.value}`}
        </text>
      </g>
    );
  };
}
