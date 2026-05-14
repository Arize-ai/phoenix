import { css } from "@emotion/react";

import { ChartFrame } from "./ChartFrame";
import { chartColors } from "./colors";
import type { ChartDatum } from "./types";

const barsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
`;

const barRowCSS = css`
  display: flex;
  gap: var(--global-dimension-size-150);
  align-items: center;
`;

const barLabelCSS = css`
  width: 100px;
  flex-shrink: 0;
  text-align: right;
  color: var(--global-text-color-500);
  font-size: var(--global-dimension-font-size-75);
`;

const barTrackCSS = css`
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: var(--global-color-gray-100);
  overflow: hidden;
`;

const barFillCSS = css`
  height: 100%;
  border-radius: inherit;
  background: ${chartColors[0]};
`;

const barValueCSS = css`
  width: 40px;
  flex-shrink: 0;
  color: var(--global-text-color-500);
  font-family: var(--ac-global-font-mono-family);
  font-size: var(--global-dimension-font-size-75);
`;

export function BarChart({
  title,
  data,
}: {
  title: string | null;
  data: ChartDatum[];
}) {
  return (
    <ChartFrame title={title}>
      <BarSeries data={data} />
    </ChartFrame>
  );
}

export function BarSeries({
  data,
  color = chartColors[0],
}: {
  data: ChartDatum[];
  color?: string;
}) {
  const maxValue = Math.max(...data.map((datum) => Math.abs(datum.value)), 1);

  return (
    <div css={barsCSS}>
      {data.map((datum) => {
        const width = `${Math.max(2, (Math.abs(datum.value) / maxValue) * 100)}%`;
        return (
          <div css={barRowCSS} key={datum.label}>
            <span css={barLabelCSS}>{datum.label}</span>
            <div css={barTrackCSS}>
              <div css={barFillCSS} style={{ background: color, width }} />
            </div>
            <span css={barValueCSS}>{datum.value}</span>
          </div>
        );
      })}
    </div>
  );
}
