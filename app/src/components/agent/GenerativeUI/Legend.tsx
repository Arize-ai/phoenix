import { css } from "@emotion/react";

import { Text } from "@phoenix/components/core/content";

import { chartColors } from "./colors";
import type { ChartDatum } from "./types";

const legendCSS = css`
  margin-top: var(--global-dimension-size-100);
  display: flex;
  flex-wrap: wrap;
  gap: var(--global-dimension-size-100);
`;

const legendItemCSS = css`
  display: inline-flex;
  gap: var(--global-dimension-size-50);
  align-items: center;
`;

const swatchCSS = css`
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--global-color-primary);
`;

export function ChartLegend({
  data,
  showSwatches = false,
}: {
  data: ChartDatum[];
  showSwatches?: boolean;
}) {
  return (
    <div css={legendCSS}>
      {data.map((datum, index) => (
        <span css={legendItemCSS} key={datum.label}>
          {showSwatches ? (
            <span
              css={swatchCSS}
              style={{ background: chartColors[index % chartColors.length] }}
            />
          ) : null}
          <Text size="XS" color="text-700">
            {datum.label}: {datum.value}
          </Text>
        </span>
      ))}
    </div>
  );
}
