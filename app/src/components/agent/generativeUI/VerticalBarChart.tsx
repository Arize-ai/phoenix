import { css } from "@emotion/react";
import { useMemo } from "react";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartEmptyStateOverlay,
  defaultCartesianGridProps,
  useGrayscaleCategoricalColors,
} from "@phoenix/components/chart";

import { ChartFrame } from "./ChartFrame";
import type { VerticalBarDatum } from "./types";

const CHART_HEIGHT = 114;
const CHART_MARGINS = { top: 4, right: 0, left: 0, bottom: 20 };
const MAX_BAR_SIZE = 18;

const legendRowCSS = css`
  display: flex;
  margin-top: var(--global-dimension-size-50);
`;

const legendCSS = css`
  display: flex;
  gap: var(--global-dimension-size-150);
  margin-left: var(--global-dimension-size-400);
`;

const legendItemCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-50);
`;

const legendSwatchCSS = css`
  width: var(--global-dimension-size-100);
  height: var(--global-dimension-size-100);
  border-radius: var(--global-rounding-xsmall);
`;

const legendLabelCSS = css`
  font-size: var(--global-dimension-font-size-50);
  color: var(--global-color-gray-600);
`;

function CustomXAxisTick(props: {
  x?: number;
  y?: number;
  payload?: { value: string };
  index?: number;
  visibleTicksCount?: number;
}) {
  const { x = 0, y = 0, payload, index = 0, visibleTicksCount = 1 } = props;
  const isFirst = index === 0;
  const isLast = index === visibleTicksCount - 1;
  const textAnchor = isFirst ? "start" : isLast ? "end" : "middle";

  return (
    <text
      x={x}
      y={y + 10}
      textAnchor={textAnchor}
      fontSize={9}
      fill="var(--chart-axis-text-color)"
    >
      {payload?.value}
    </text>
  );
}

export function VerticalBarChart({
  title,
  data,
  baseLabel,
  highlightLabel,
}: {
  title: string | null;
  data: VerticalBarDatum[];
  baseLabel?: string | null;
  highlightLabel?: string | null;
}) {
  const colors = useGrayscaleCategoricalColors();
  const baseColor = colors.gray1;
  const highlightColor = colors.gray2;

  const hasHighlight = useMemo(
    () => data.some((datum) => datum.highlight != null && datum.highlight > 0),
    [data]
  );
  const chartData = useMemo(
    () =>
      data.map((datum) => {
        const highlightValue = Math.max(datum.highlight ?? 0, 0);
        return {
          label: datum.label,
          baseValue: datum.value,
          highlightValue,
          totalValue: datum.value + highlightValue,
        };
      }),
    [data]
  );

  const maxValue = Math.max(...chartData.map((datum) => datum.totalValue), 1);
  const yAxisWidth = Math.max(
    ...[0, Math.round(maxValue / 2), maxValue].map(
      (value) => String(value).length * 7 + 4
    ),
    20
  );
  const hasData = data.length > 0;

  return (
    <ChartFrame title={title}>
      <ChartEmptyStateOverlay isEmpty={!hasData}>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <RechartsBarChart data={chartData} margin={CHART_MARGINS}>
            <CartesianGrid {...defaultCartesianGridProps} />
            <YAxis
              width={yAxisWidth}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: "var(--chart-axis-text-color)" }}
              tickCount={3}
              domain={[0, "dataMax"]}
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={<CustomXAxisTick />}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            {hasHighlight ? (
              <>
                <Bar
                  dataKey="baseValue"
                  stackId="verticalBarChart"
                  fill={baseColor}
                  maxBarSize={MAX_BAR_SIZE}
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="highlightValue"
                  stackId="verticalBarChart"
                  fill={highlightColor}
                  maxBarSize={MAX_BAR_SIZE}
                  radius={[2, 2, 0, 0]}
                />
              </>
            ) : (
              <Bar
                dataKey="baseValue"
                fill={baseColor}
                maxBarSize={MAX_BAR_SIZE}
                radius={[2, 2, 0, 0]}
              />
            )}
          </RechartsBarChart>
        </ResponsiveContainer>
      </ChartEmptyStateOverlay>
      {hasHighlight && baseLabel && highlightLabel && (
        <div css={legendRowCSS}>
          <div css={legendCSS}>
            <div css={legendItemCSS}>
              <div css={legendSwatchCSS} style={{ background: baseColor }} />
              <span css={legendLabelCSS}>{baseLabel}</span>
            </div>
            <div css={legendItemCSS}>
              <div
                css={legendSwatchCSS}
                style={{ background: highlightColor }}
              />
              <span css={legendLabelCSS}>{highlightLabel}</span>
            </div>
          </div>
        </div>
      )}
    </ChartFrame>
  );
}
