import { css } from "@emotion/react";

import { Text } from "@phoenix/components/core/content";

import { BarSeries } from "./BarChart";
import { ChartFrame } from "./ChartFrame";
import { chartColors } from "./colors";
import type { SeriesDatum } from "./types";

const multiSeriesCSS = css`
  display: grid;
  gap: var(--global-dimension-size-100);
`;

export function MultiSeriesChart({
  title,
  series,
}: {
  title: string | null;
  series: SeriesDatum[];
}) {
  return (
    <ChartFrame title={title}>
      <div css={multiSeriesCSS}>
        {series.map((seriesItem, seriesIndex) => (
          <div key={seriesItem.label}>
            <Text weight="heavy" size="XS">
              {seriesItem.label}
            </Text>
            <BarSeries
              data={seriesItem.values}
              color={chartColors[seriesIndex % chartColors.length]}
            />
          </div>
        ))}
      </div>
    </ChartFrame>
  );
}
