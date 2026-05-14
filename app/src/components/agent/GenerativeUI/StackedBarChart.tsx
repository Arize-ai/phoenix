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
  gap: 6px;
`;

const rowCSS = css`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const labelCSS = css`
  width: 60px;
  flex-shrink: 0;
  text-align: right;
  color: var(--global-text-color-700);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const trackCSS = css`
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--global-color-gray-300);
  overflow: hidden;
  display: flex;
  gap: 2px;
`;

const valueCSS = css`
  width: 40px;
  flex-shrink: 0;
  color: var(--global-text-color-700);
  font-size: 11px;
`;

const legendCSS = css`
  display: flex;
  gap: 12px;
  margin-left: 72px;
  margin-top: 4px;
`;

const legendItemCSS = css`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const legendSwatchCSS = css`
  width: 8px;
  height: 8px;
  border-radius: 2px;
`;

const legendLabelCSS = css`
  font-size: 11px;
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
