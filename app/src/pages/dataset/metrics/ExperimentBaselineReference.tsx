import type { LegendPayload, XAxisTickContentProps } from "recharts";
import { ReferenceLine } from "recharts";

export const BASELINE_COLOR = "var(--global-color-indigo-500)";

export const BASELINE_STROKE_DASHARRAY = "4 4";

const BASELINE_LEGEND_ITEMS: ReadonlyArray<LegendPayload> = [
  {
    value: "baseline",
    type: "plainline",
    color: BASELINE_COLOR,
    payload: { strokeDasharray: BASELINE_STROKE_DASHARRAY },
  },
];

export function getExperimentBaselineLegendItems(
  value: number | null | undefined
): ReadonlyArray<LegendPayload> {
  return typeof value === "number" ? BASELINE_LEGEND_ITEMS : [];
}

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

export function ExperimentBaselineDistributionSeparator({
  value,
}: {
  value: number | null | undefined;
}) {
  if (typeof value !== "number") {
    return null;
  }
  // Evaluation baselines are prepended as bars, so separate the first
  // category from the seven-experiment comparison window.
  return (
    <ReferenceLine
      x={value}
      position="end"
      stroke={BASELINE_COLOR}
      strokeDasharray={BASELINE_STROKE_DASHARRAY}
      strokeWidth={1}
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
