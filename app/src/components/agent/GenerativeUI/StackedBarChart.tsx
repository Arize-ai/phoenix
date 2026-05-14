import { css } from "@emotion/react";

import { ChartFrame } from "./ChartFrame";
import { chartColors } from "./colors";
import type { StackedBarDatum } from "./types";

const rowsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

const rowCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-150);
`;

const labelCSS = css`
  width: 72px;
  flex-shrink: 0;
  text-align: right;
  color: var(--global-text-color-500);
  font-size: var(--global-dimension-font-size-75);
`;

const trackCSS = css`
  flex: 1;
  display: flex;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--global-color-gray-100);
`;

const valueCSS = css`
  width: 48px;
  flex-shrink: 0;
  color: var(--global-text-color-500);
  font-family: var(--ac-global-font-mono-family);
  font-size: var(--global-dimension-font-size-75);
`;

const legendCSS = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--global-dimension-size-150);
  margin-left: 84px;
  color: var(--global-text-color-500);
  font-size: var(--global-dimension-font-size-75);
`;

export function StackedBarChart({
  title,
  data,
}: {
  title: string | null;
  data: StackedBarDatum[];
}) {
  const totals = data.map((datum) =>
    datum.segments.reduce((sum, segment) => sum + segment.value, 0)
  );
  const maxValue = Math.max(...totals, 1);
  const legendLabels = Array.from(
    new Set(
      data.flatMap((datum) => datum.segments.map((segment) => segment.label))
    )
  );

  return (
    <ChartFrame title={title}>
      <div css={rowsCSS} role="img" aria-label="Generated stacked bar chart">
        {data.map((datum, datumIndex) => (
          <div key={datum.label} css={rowCSS}>
            <span css={labelCSS}>{datum.label}</span>
            <div css={trackCSS}>
              {datum.segments.map((segment) => (
                <div
                  key={`${datum.label}-${segment.label}`}
                  style={{
                    width: `${(segment.value / maxValue) * 100}%`,
                    background:
                      chartColors[
                        legendLabels.indexOf(segment.label) % chartColors.length
                      ],
                  }}
                />
              ))}
            </div>
            <span css={valueCSS}>{totals[datumIndex].toLocaleString()}</span>
          </div>
        ))}
        <div css={legendCSS}>
          {legendLabels.map((label, index) => (
            <span key={label}>
              <span style={{ color: chartColors[index % chartColors.length] }}>
                ■
              </span>{" "}
              {label}
            </span>
          ))}
        </div>
      </div>
    </ChartFrame>
  );
}
