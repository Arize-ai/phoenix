import { css } from "@emotion/react";

import { ChartFrame } from "./ChartFrame";
import { chartColors } from "./colors";
import type { VerticalBarDatum } from "./types";

const chartCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
`;

const plotCSS = css`
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 72px;
`;

const barCSS = css`
  flex: 1;
  min-height: 2px;
  border-radius: 2px;
  overflow: hidden;
  background: ${chartColors[1]};
`;

const xAxisCSS = css`
  display: flex;
  justify-content: space-between;
  color: var(--global-text-color-500);
  font-size: var(--global-dimension-font-size-75);
`;

const legendCSS = css`
  display: flex;
  gap: var(--global-dimension-size-150);
  color: var(--global-text-color-500);
  font-size: var(--global-dimension-font-size-75);
`;

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
  const maxValue = Math.max(
    ...data.map((datum) => datum.value + (datum.highlight ?? 0)),
    1
  );

  return (
    <ChartFrame title={title}>
      <div css={chartCSS}>
        <div css={plotCSS} role="img" aria-label="Generated vertical bar chart">
          {data.map((datum) => {
            const total = datum.value + (datum.highlight ?? 0);
            const height = `${Math.max(2, (total / maxValue) * 100)}%`;
            const highlightHeight =
              total > 0 ? `${((datum.highlight ?? 0) / total) * 100}%` : "0%";
            return (
              <div key={datum.label} css={barCSS} style={{ height }}>
                {datum.highlight ? (
                  <div
                    style={{
                      height: highlightHeight,
                      background: chartColors[0],
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
        <div css={xAxisCSS}>
          {data.map((datum) => (
            <span key={datum.label}>{datum.label}</span>
          ))}
        </div>
        {baseLabel || highlightLabel ? (
          <div css={legendCSS}>
            {baseLabel ? (
              <span>
                <span style={{ color: chartColors[1] }}>■</span> {baseLabel}
              </span>
            ) : null}
            {highlightLabel ? (
              <span>
                <span style={{ color: chartColors[0] }}>■</span>{" "}
                {highlightLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </ChartFrame>
  );
}
