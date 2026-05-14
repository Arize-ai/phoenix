import { css } from "@emotion/react";
import { useMemo } from "react";

import { useGrayscaleCategoricalColors } from "@phoenix/components/chart";

import { ChartFrame } from "./ChartFrame";
import type { VerticalBarDatum } from "./types";

const containerCSS = css`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const chartRowCSS = css`
  display: flex;
  gap: 8px;
  padding-right: 8px;
`;

const yAxisCSS = css`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 60px;
  font-size: 11px;
  color: var(--global-text-color-700);
  text-align: right;
  flex-shrink: 0;
`;

const plotAreaCSS = css`
  flex: 1;
  position: relative;
  height: 60px;
`;

const gridLineCSS = css`
  position: absolute;
  left: 0;
  right: 0;
  border-bottom: 1px solid var(--global-color-gray-200);
`;

const barsContainerCSS = css`
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 100%;
  position: relative;
`;

const barCSS = css`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border-radius: 2px;
  min-height: 2px;
  overflow: hidden;
`;

const xAxisRowCSS = css`
  display: flex;
  gap: 8px;
  padding-right: 8px;
`;

const xAxisSpacerCSS = css`
  flex-shrink: 0;
`;

const xAxisCSS = css`
  flex: 1;
  display: flex;
  gap: 3px;
`;

const xLabelCSS = css`
  flex: 1;
  text-align: center;
  font-size: 11px;
  color: var(--global-text-color-700);
`;

const legendRowCSS = css`
  display: flex;
  gap: 8px;
  padding-right: 8px;
`;

const legendCSS = css`
  display: flex;
  gap: 12px;
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
  color: var(--global-text-color-700);
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
  const colors = useGrayscaleCategoricalColors();
  const baseColor = colors.gray1;
  const highlightColor = colors.gray2;

  const hasHighlight = useMemo(
    () => data.some((datum) => datum.highlight != null && datum.highlight > 0),
    [data]
  );

  const maxValue = Math.max(
    ...data.map((datum) => datum.value + (datum.highlight ?? 0)),
    1
  );

  const gridLines = [0, Math.round(maxValue / 2), maxValue];

  // Calculate Y-axis width based on the longest label
  const yAxisWidth = Math.max(
    ...gridLines.map((v) => String(v).length * 7 + 4),
    20
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
      <div css={containerCSS}>
        <div css={chartRowCSS}>
          <div css={yAxisCSS} style={{ width: yAxisWidth }}>
            {gridLines
              .slice()
              .reverse()
              .map((v) => (
                <span key={v}>{v}</span>
              ))}
          </div>
          <div css={plotAreaCSS}>
            {gridLines.map((v) => (
              <div
                key={v}
                css={gridLineCSS}
                style={{ bottom: `${(v / maxValue) * 100}%` }}
              />
            ))}
            <div css={barsContainerCSS}>
              {data.map((datum, i) => {
                const total = datum.value + (datum.highlight ?? 0);
                const heightPercent = (total / maxValue) * 100;
                return (
                  <div
                    key={datum.label ?? i}
                    css={barCSS}
                    style={{ height: `${heightPercent}%` }}
                  >
                    {hasHighlight && datum.highlight != null && datum.highlight > 0 && (
                      <div
                        style={{
                          height: `${(datum.highlight / total) * 100}%`,
                          background: highlightColor,
                          minHeight: 2,
                        }}
                      />
                    )}
                    <div style={{ flex: 1, background: baseColor }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div css={xAxisRowCSS}>
          <div css={xAxisSpacerCSS} style={{ width: yAxisWidth }} />
          <div css={xAxisCSS}>
            {data.map((datum) => (
              <span key={datum.label} css={xLabelCSS}>
                {datum.label}
              </span>
            ))}
          </div>
        </div>
        {hasHighlight && baseLabel && highlightLabel && (
          <div css={legendRowCSS}>
            <div css={xAxisSpacerCSS} style={{ width: yAxisWidth }} />
            <div css={legendCSS}>
              <div css={legendItemCSS}>
                <div css={legendSwatchCSS} style={{ background: baseColor }} />
                <span css={legendLabelCSS}>{baseLabel}</span>
              </div>
              <div css={legendItemCSS}>
                <div css={legendSwatchCSS} style={{ background: highlightColor }} />
                <span css={legendLabelCSS}>{highlightLabel}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </ChartFrame>
  );
}

function NoData() {
  return (
    <span style={{ color: "var(--global-text-color-500)" }}>No data</span>
  );
}
