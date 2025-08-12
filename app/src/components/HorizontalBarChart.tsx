import { css } from "@emotion/react";

import { SizingProps } from "@phoenix/components/types";

type HorizontalBarChartProps = {
  bars: {
    value: number;
    color: string;
  }[];
} & SizingProps;

export function HorizontalBarChart({ bars }: HorizontalBarChartProps) {
  if (bars.length === 0) {
    return null;
  }
  const maxValue = Math.max(...bars.map((bar) => bar.value));
  let barLengths: number[] = [];
  if (maxValue !== 0) {
    barLengths = bars.map((bar) => (bar.value / maxValue) * 100);
  } else {
    barLengths = bars.map(() => 0);
  }
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        width: 100%;
      `}
    >
      {bars.map((bar, index) => (
        <div
          key={index}
          css={css`
            background-color: ${bar.color};
            height: 0.3rem;
            border-radius: 2px;
            width: ${barLengths[index]}%;
          `}
        />
      ))}
    </div>
  );
}
