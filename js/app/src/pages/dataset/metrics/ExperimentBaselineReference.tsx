import type { LegendPayload, XAxisTickContentProps } from "recharts";
import { ReferenceLine } from "recharts";

import type { ExperimentMetricsSelection } from "./types";

export const BASELINE_COLOR = "var(--global-color-purple-500)";

export const BASELINE_STROKE_DASHARRAY = "4 4";

/**
 * What the reference experiment is called: the dataset baseline, or the base
 * experiment of a selection.
 */
export type ExperimentReferenceLabel = "baseline" | "base";

export function getExperimentReferenceLabel(
  selection: ExperimentMetricsSelection | undefined
): ExperimentReferenceLabel {
  return selection == null ? "baseline" : "base";
}

export function getExperimentBaselineLegendItems({
  value,
  label = "baseline",
}: {
  value: number | null | undefined;
  label?: ExperimentReferenceLabel;
}): ReadonlyArray<LegendPayload> {
  if (typeof value !== "number") {
    return [];
  }
  return [
    {
      value: label,
      type: "plainline",
      color: BASELINE_COLOR,
      payload: { strokeDasharray: BASELINE_STROKE_DASHARRAY },
    },
  ];
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
  // Out-of-window annotation baselines are prepended as bars, so separate the
  // category from the seven-experiment comparison window.
  return (
    <ReferenceLine
      x={value}
      position="end"
      stroke="var(--chart-axis-stroke-color)"
      strokeWidth={1}
    />
  );
}

/**
 * Builds the experiment x axis tick: the experiment's sequence number, bold
 * and in the baseline color for the reference experiment, led by a dot in the
 * experiment's color when it has one.
 */
export function makeExperimentAxisTick({
  baselineSequenceNumber,
  experimentColors,
}: {
  baselineSequenceNumber?: number;
  experimentColors?: ReadonlyMap<number, string>;
}) {
  return function ExperimentAxisTick({
    x,
    y,
    payload,
    textAnchor,
  }: XAxisTickContentProps) {
    const isBaseline = payload.value === baselineSequenceNumber;
    const experimentColor = experimentColors?.get(Number(payload.value));
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          dy="0.71em"
          textAnchor={textAnchor}
          fontSize="12px"
          fontWeight={isBaseline ? 600 : undefined}
          fill={isBaseline ? BASELINE_COLOR : "var(--chart-axis-text-color)"}
        >
          {experimentColor != null && (
            <tspan fill={experimentColor} aria-hidden>
              {"\u25CF "}
            </tspan>
          )}
          {`#${payload.value}`}
        </text>
      </g>
    );
  };
}
