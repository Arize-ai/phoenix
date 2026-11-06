import { css } from "@emotion/react";

import { useGrayscaleCategoricalColors } from "@phoenix/components/chart";
import { formatIntShort } from "@phoenix/utils/numberFormatUtils";

import { ChartFrame } from "./ChartFrame";
import type { ChartDatum } from "./types";

const rowsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
`;

const rowCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-150);
`;

const labelCSS = css`
  width: var(--global-dimension-size-1250);
  flex-shrink: 0;
  text-align: right;
  color: var(--global-text-color-700);
  font-size: var(--global-dimension-font-size-75);
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
`;

const barCSS = css`
  height: 100%;
  border-radius: var(--global-dimension-size-40);
`;

const valueCSS = css`
  width: var(--global-dimension-size-500);
  flex-shrink: 0;
  color: var(--global-text-color-700);
  font-size: var(--global-dimension-font-size-75);
`;

export function BarChart({
  title,
  data,
}: {
  title: string | null;
  data: ChartDatum[];
}) {
  const colors = useGrayscaleCategoricalColors();
  const barColor = colors.gray1;
  const maxValue = Math.max(...data.map((d) => Math.abs(d.value)), 1);

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
        {data.map((datum) => {
          const width = `${(Math.abs(datum.value) / maxValue) * 100}%`;
          return (
            <div key={datum.label} css={rowCSS}>
              <span css={labelCSS} title={datum.label}>
                {datum.label}
              </span>
              <div css={trackCSS}>
                <div css={barCSS} style={{ width, background: barColor }} />
              </div>
              <span css={valueCSS}>{formatIntShort(datum.value)}</span>
            </div>
          );
        })}
      </div>
    </ChartFrame>
  );
}

function NoData() {
  return <span style={{ color: "var(--global-text-color-500)" }}>No data</span>;
}
