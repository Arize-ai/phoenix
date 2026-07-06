import { css } from "@emotion/react";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartEmptyStateOverlay,
  defaultCartesianGridProps,
  GRAYSCALE_CATEGORICAL_COLORS,
  useGrayscaleCategoricalColors,
} from "@phoenix/components/chart";

import { ChartFrame } from "./ChartFrame";
import type { LineSeries } from "./types";

const CHART_HEIGHT = 98; // 90px data + 4px top + 4px bottom margin
const CHART_HEIGHT_WITH_XAXIS = 114; // 90px data + 4px top + 20px bottom margin
const CHART_MARGINS = { top: 4, right: 8, left: 0, bottom: 4 };
const CHART_MARGINS_WITH_XAXIS = { top: 4, right: 0, left: 0, bottom: 20 };

const legendCSS = css`
  display: flex;
  gap: var(--global-dimension-size-150);
  margin-left: var(--global-dimension-size-350);
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
  font-size: var(--global-dimension-font-size-25);
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

export function LineChart({
  title,
  lines,
  xLabels,
}: {
  title: string | null;
  lines: LineSeries[];
  xLabels?: string[] | null;
}) {
  const colors = useGrayscaleCategoricalColors();

  const { data, seriesKeys } = useMemo(() => {
    if (lines.length === 0) {
      return { data: [], seriesKeys: [] };
    }

    const maxLength = Math.max(...lines.map((line) => line.data.length));
    // Index-based keys so lines with duplicate labels don't clobber each
    // other's data points; labels are only used for the legend
    const seriesKeys = lines.map((_, index) => `series${index}`);

    const data = Array.from({ length: maxLength }, (_, i) => {
      const point: Record<string, string | number> = {
        x: xLabels?.[i] ?? i.toString(),
      };
      lines.forEach((line, lineIndex) => {
        const key = seriesKeys[lineIndex];
        point[key] = line.data[i] ?? null;
      });
      return point;
    });

    return { data, seriesKeys };
  }, [lines, xLabels]);

  const hasLegend = lines.some((line) => line.label);
  const hasXAxis = xLabels != null && xLabels.length > 0;
  const hasData = data.length > 0;

  return (
    <ChartFrame title={title}>
      <ChartEmptyStateOverlay isEmpty={!hasData}>
        <ResponsiveContainer
          width="100%"
          height={hasXAxis ? CHART_HEIGHT_WITH_XAXIS : CHART_HEIGHT}
        >
          <RechartsLineChart
            data={data}
            margin={hasXAxis ? CHART_MARGINS_WITH_XAXIS : CHART_MARGINS}
          >
            <CartesianGrid {...defaultCartesianGridProps} />
            <YAxis
              width={24}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: "var(--chart-axis-text-color)" }}
              tickCount={3}
            />
            {hasXAxis && (
              <XAxis
                dataKey="x"
                axisLine={false}
                tickLine={false}
                tick={<CustomXAxisTick />}
                interval="preserveStartEnd"
                minTickGap={20}
              />
            )}
            {seriesKeys.map((key, index) => {
              const colorKey =
                GRAYSCALE_CATEGORICAL_COLORS[
                  index % GRAYSCALE_CATEGORICAL_COLORS.length
                ];
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[colorKey]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={false}
                />
              );
            })}
          </RechartsLineChart>
        </ResponsiveContainer>
      </ChartEmptyStateOverlay>
      {hasLegend && (
        <div css={legendCSS}>
          {lines
            .map((line, index) => ({ line, index }))
            .filter(({ line }) => line.label)
            .map(({ line, index }) => {
              const colorKey =
                GRAYSCALE_CATEGORICAL_COLORS[
                  index % GRAYSCALE_CATEGORICAL_COLORS.length
                ];
              return (
                <div key={`${line.label}-${index}`} css={legendItemCSS}>
                  <div
                    css={legendSwatchCSS}
                    style={{ background: colors[colorKey] }}
                  />
                  <span css={legendLabelCSS}>{line.label}</span>
                </div>
              );
            })}
        </div>
      )}
    </ChartFrame>
  );
}
