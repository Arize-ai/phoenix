import { css } from "@emotion/react";

import { Text } from "@phoenix/components/core/content";

import { ChartFrame } from "./ChartFrame";
import { ChartLegend } from "./Legend";
import type { ChartDatum } from "./types";

const lineCSS = css`
  width: 100%;
  height: 140px;
  overflow: visible;
`;

const linePathCSS = css`
  fill: none;
  stroke: var(--global-color-primary);
  stroke-width: 2.5;
`;

const linePointCSS = css`
  fill: var(--global-color-primary);
`;

export function LineChart({
  title,
  data,
}: {
  title: string | null;
  data: ChartDatum[];
}) {
  return (
    <ChartFrame title={title}>
      <LineSeries data={data} />
    </ChartFrame>
  );
}

function LineSeries({ data }: { data: ChartDatum[] }) {
  if (data.length === 0) {
    return <Text color="text-700">No data</Text>;
  }

  const values = data.map((datum) => datum.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const points = data.map((datum, index) => {
    const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
    const y = 100 - ((datum.value - minValue) / range) * 100;
    return { ...datum, x, y };
  });
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <>
      <svg
        css={lineCSS}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label="Generated line chart"
      >
        <path css={linePathCSS} d={path} />
        {points.map((point) => (
          <circle
            key={point.label}
            css={linePointCSS}
            cx={point.x}
            cy={point.y}
            r="2"
          />
        ))}
      </svg>
      <ChartLegend data={data} />
    </>
  );
}
