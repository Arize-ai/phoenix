import { css } from "@emotion/react";

import {
  GRAYSCALE_CATEGORICAL_COLORS,
  useGrayscaleCategoricalColors,
} from "@phoenix/components/chart";

import { ChartFrame } from "./ChartFrame";
import type { StackedBarDatum } from "./types";

const rowsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-75);
`;

const rowCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-150);
`;

const labelCSS = css`
  width: var(--global-dimension-size-750);
  flex-shrink: 0;
  text-align: right;
  color: var(--global-text-color-700);
  font-size: var(--global-dimension-font-size-50);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const trackCSS = css`
  flex: 1;
  height: var(--global-dimension-size-75);
  border-radius: var(--global-dimension-size-40);
  background: var(--global-color-gray-300);
  overflow: hidden;
  display: flex;
  gap: var(--global-dimension-size-25);
`;

const valueCSS = css`
  width: var(--global-dimension-size-500);
  flex-shrink: 0;
  color: var(--global-text-color-700);
  font-size: var(--global-dimension-font-size-50);
`;

const legendCSS = css`
  display: flex;
  gap: var(--global-dimension-size-150);
  margin-left: var(--global-dimension-size-900);
  margin-top: var(--global-dimension-size-50);
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

export function StackedBarChart({
  title,
  data,
}: {
  title: string | null;
  data: StackedBarDatum[];
}) {
  const colors = useGrayscaleCategoricalColors();
  const totals = data.map((datum) =>
    datum.segments.reduce((sum, seg) => sum + seg.value, 0)
  );
  const maxValue = Math.max(...totals, 1);

  const legendLabels = Array.from(
    new Set(data.flatMap((datum) => datum.segments.map((seg) => seg.label)))
  );

  if (data.length === 0) {
    return (
      <ChartFrame title={title}>
        <NoData />
      </ChartFrame>
    );
  }

  return (
    <ChartFrame title={title}>
      <div css={rowsCSS}>
        {data.map((datum, datumIndex) => {
          const total = totals[datumIndex];
          return (
            <div key={datum.label} css={rowCSS}>
              <span css={labelCSS} title={datum.label}>
                {datum.label}
              </span>
              <div css={trackCSS}>
                {datum.segments.map((segment) => {
                  const width = `${(segment.value / maxValue) * 100}%`;
                  const colorIndex = legendLabels.indexOf(segment.label);
                  const colorKey =
                    GRAYSCALE_CATEGORICAL_COLORS[
                      colorIndex % GRAYSCALE_CATEGORICAL_COLORS.length
                    ];
                  return (
                    <div
                      key={segment.label}
                      style={{ width, background: colors[colorKey] }}
                    />
                  );
                })}
              </div>
              <span css={valueCSS}>{total.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
      {legendLabels.length > 1 && (
        <div css={legendCSS}>
          {legendLabels.map((label, index) => {
            const colorKey =
              GRAYSCALE_CATEGORICAL_COLORS[
                index % GRAYSCALE_CATEGORICAL_COLORS.length
              ];
            return (
              <div key={label} css={legendItemCSS}>
                <div
                  css={legendSwatchCSS}
                  style={{ background: colors[colorKey] }}
                />
                <span css={legendLabelCSS}>{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </ChartFrame>
  );
}

function NoData() {
  return <span style={{ color: "var(--global-text-color-500)" }}>No data</span>;
}
