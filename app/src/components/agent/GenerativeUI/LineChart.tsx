import { css } from "@emotion/react";

import { ChartFrame } from "./ChartFrame";
import { chartColors } from "./colors";
import type { LineSeries } from "./types";

const lineCSS = css`
  width: 100%;
  height: 80px;
  overflow: visible;
`;

const legendCSS = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--global-dimension-size-150);
  margin-left: 28px;
  color: var(--global-text-color-500);
  font-size: var(--global-dimension-font-size-75);
`;

const noDataCSS = css`
  color: var(--global-text-color-500);
`;

export function LineChart({
  title,
  lines,
  xLabels,
}: {
  title: string | null;
  lines: LineSeries[];
  xLabels?: string[] | null;
}) {
  return (
    <ChartFrame title={title}>
      <LineSeriesChart lines={lines} xLabels={xLabels} />
    </ChartFrame>
  );
}

function LineSeriesChart({
  lines,
  xLabels,
}: {
  lines: LineSeries[];
  xLabels?: string[] | null;
}) {
  const allValues = lines.flatMap((line) => line.data);
  if (allValues.length === 0) {
    return <span css={noDataCSS}>No data</span>;
  }

  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const range = maxValue - minValue || 1;
  const gridLines = [minValue, Math.round((minValue + maxValue) / 2), maxValue];
  const hasLegend = lines.some((line) => line.label);

  return (
    <>
      <svg
        css={lineCSS}
        viewBox="0 0 240 80"
        role="img"
        aria-label="Generated line chart"
      >
        {gridLines.map((value) => {
          const y = 8 + 56 - ((value - minValue) / range) * 56;
          return (
            <g key={value}>
              <line
                x1="28"
                y1={y}
                x2="240"
                y2={y}
                stroke="var(--global-color-gray-200)"
              />
              <text
                x="24"
                y={y + 3}
                fill="var(--global-text-color-400)"
                fontSize="9"
                textAnchor="end"
              >
                {value}
              </text>
            </g>
          );
        })}
        {lines.map((line, lineIndex) => (
          <polyline
            key={line.label ?? lineIndex}
            points={getLinePoints({ data: line.data, minValue, range })}
            fill="none"
            stroke={chartColors[lineIndex % chartColors.length]}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {xLabels?.map((label, index) => (
          <text
            key={`${label}-${index}`}
            x={28 + (index / Math.max(xLabels.length - 1, 1)) * 212}
            y="78"
            fill="var(--global-text-color-400)"
            fontSize="9"
            textAnchor="middle"
          >
            {label}
          </text>
        ))}
      </svg>
      {hasLegend ? (
        <div css={legendCSS}>
          {lines.map((line, index) =>
            line.label ? (
              <span key={line.label}>
                <span
                  style={{ color: chartColors[index % chartColors.length] }}
                >
                  ■
                </span>{" "}
                {line.label}
              </span>
            ) : null
          )}
        </div>
      ) : null}
    </>
  );
}

function getLinePoints({
  data,
  minValue,
  range,
}: {
  data: number[];
  minValue: number;
  range: number;
}) {
  return data
    .map((value, index) => {
      const x =
        data.length === 1 ? 134 : 28 + (index / (data.length - 1)) * 212;
      const y = 8 + 56 - ((value - minValue) / range) * 56;
      return `${x},${y}`;
    })
    .join(" ");
}
