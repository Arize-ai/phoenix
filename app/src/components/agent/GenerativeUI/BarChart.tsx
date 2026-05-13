import { css } from "@emotion/react";

import { Text } from "@phoenix/components/core/content";

import { ChartFrame } from "./ChartFrame";
import type { ChartDatum } from "./types";

const barsCSS = css`
  display: grid;
  gap: var(--global-dimension-size-100);
`;

const barRowCSS = css`
  display: grid;
  grid-template-columns: minmax(72px, 1fr) 3fr auto;
  gap: var(--global-dimension-size-100);
  align-items: center;
`;

const barTrackCSS = css`
  height: 10px;
  border-radius: 999px;
  background: var(--global-color-gray-300);
  overflow: hidden;
`;

const barFillCSS = css`
  height: 100%;
  border-radius: inherit;
  background: var(--global-color-primary);
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
  color = "var(--global-color-primary)",
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
            <Text size="XS" color="text-700">
              {datum.label}
            </Text>
            <div css={barTrackCSS}>
              <div css={barFillCSS} style={{ background: color, width }} />
            </div>
            <Text size="XS" fontFamily="mono">
              {datum.value}
            </Text>
          </div>
        );
      })}
    </div>
  );
}
